import * as SecureStore from 'expo-secure-store';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-api-production.up.railway.app') + '/api';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('auth_token', token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}

// Single in-flight refresh promise shared across concurrent 401s
let _refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const oldToken = await SecureStore.getItemAsync('auth_token');
      if (!oldToken) return null;
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${oldToken}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data?.token) {
        await SecureStore.setItemAsync('auth_token', data.token);
        return data.token;
      }
      return null;
    } catch {
      return null;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

// Transient-failure retry. Railway wakes cold containers on the first hit after
// idle, and a mobile link to a US region drops the occasional connection — both
// surface as a thrown fetch or a 503/504, and both mean the request never
// reached application code, so replaying it is safe. A client-side timeout is
// NOT safe to replay for a write (the server may have processed it), so those
// only retry for GET. Anything that could double-charge passes noRetry.
const MAX_NET_RETRIES = 2;
const RETRY_BACKOFF_MS = [500, 1200];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface RequestConfig {
  timeoutMs?: number;
  noRetry?: boolean;
  _isAuthRetry?: boolean;
  _netAttempt?: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  config: RequestConfig = {},
): Promise<T> {
  const { timeoutMs = 30_000, noRetry = false, _isAuthRetry = false, _netAttempt = 0 } = config;
  const method = (options.method ?? 'GET').toUpperCase();
  const isGet = method === 'GET';
  const canRetry = !noRetry && _netAttempt < MAX_NET_RETRIES;

  const retryAfterBackoff = (): Promise<T> =>
    sleep(RETRY_BACKOFF_MS[_netAttempt] ?? 1200).then(() =>
      request<T>(path, options, { ...config, _netAttempt: _netAttempt + 1 }),
    );

  const token = await SecureStore.getItemAsync('auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      // Timed out. Safe to replay only for reads.
      if (canRetry && isGet) return retryAfterBackoff();
      throw new Error('Request timed out. The server may be waking up — please try again in a moment.');
    }
    const msg: string = err?.message ?? '';
    const isNetwork = msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('network');
    if (isNetwork) {
      // The connection never opened, so nothing ran server-side — replay any method.
      if (canRetry) return retryAfterBackoff();
      throw new Error('Could not reach the server. If this is your first request, it may be starting up — wait a few seconds and try again.');
    }
    throw err;
  }
  clearTimeout(timer);

  // 503/504 from Railway's edge mean the request was never dispatched to a
  // healthy container — replay any method.
  if ((res.status === 503 || res.status === 504) && canRetry) {
    return retryAfterBackoff();
  }

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }

  if (!res.ok) {
    // On 401, attempt a silent token refresh and retry once
    if (res.status === 401 && !_isAuthRetry) {
      const newToken = await tryRefresh();
      if (newToken) {
        return request<T>(path, options, { ...config, _isAuthRetry: true });
      }
    }
    const apiErr = Object.assign(
      new Error(json?.error ?? `Request failed (${res.status})`),
      { status: res.status },
    );
    throw apiErr;
  }

  return json;
}

function withParams(path: string, params?: Record<string, unknown>): string {
  if (!params) return path;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) q.set(key, String(value));
  }
  const qs = q.toString();
  if (!qs) return path;
  return path + (path.includes('?') ? '&' : '?') + qs;
}

interface WriteOpts {
  /** Skip transient-failure retry. Set on anything that could double-charge or
   *  double-create if replayed (payments, order creation, wallet moves). */
  noRetry?: boolean;
}

export const api = {
  get: <T>(path: string, opts?: { params?: Record<string, unknown> }) =>
    request<T>(withParams(path, opts?.params)),
  post: <T>(path: string, body: unknown, opts?: WriteOpts) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, { noRetry: opts?.noRetry }),
  patch: <T>(path: string, body: unknown, opts?: WriteOpts) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, { noRetry: opts?.noRetry }),
  put: <T>(path: string, body: unknown, opts?: WriteOpts) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, { noRetry: opts?.noRetry }),
  delete: <T>(path: string, opts?: WriteOpts) =>
    request<T>(path, { method: 'DELETE' }, { noRetry: opts?.noRetry }),
};
