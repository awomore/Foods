const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  sendOtp: (phone: string) =>
    api.post<{ message: string }>('/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string) =>
    api.post<{ token: string; user: AdminUser }>('/auth/verify-otp', { phone, otp }),
  me: () => api.get<{ user: AdminUser }>('/auth/me'),
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const statsApi = {
  overview: () => api.get<StatsOverview>('/admin/stats'),
  chart: (days = 30) => api.get<{ chart: ChartRow[] }>(`/admin/stats/chart?days=${days}`),
};

// ── Cooks ─────────────────────────────────────────────────────────────────────

export const cooksAdminApi = {
  list: (params: CookListParams) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.status) q.set('status', params.status);
    if (params.verified != null) q.set('verified', String(params.verified));
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ cooks: AdminCook[]; total: number }>(`/admin/cooks?${q}`);
  },
  get: (id: string) => api.get<{ cook: AdminCookDetail; stats: CookStats; recent_payouts: Payout[]; recent_orders: OrderSummary[] }>(`/admin/cooks/${id}`),
  verify: (id: string, body: { food_safety_verified?: boolean; id_verified?: boolean; verification_status?: string }) =>
    api.patch<{ cook: AdminCook }>(`/admin/cooks/${id}/verify`, body),
  suspend: (id: string, suspended: boolean, reason?: string) =>
    api.patch<{ cook: AdminCook }>(`/admin/cooks/${id}/suspend`, { suspended, reason }),
};

// ── Customers ─────────────────────────────────────────────────────────────────

export const customersApi = {
  list: (params: { q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ customers: AdminCustomer[]; total: number }>(`/admin/customers?${q}`);
  },
  suspend: (id: string, suspended: boolean) =>
    api.patch<{ customer: AdminCustomer }>(`/admin/customers/${id}/suspend`, { suspended }),
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const ordersAdminApi = {
  list: (params: OrderListParams) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.q) q.set('q', params.q);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ orders: AdminOrder[]; total: number }>(`/admin/orders?${q}`);
  },
  setStatus: (id: string, status: string, note?: string) =>
    api.patch<{ order: AdminOrder }>(`/admin/orders/${id}/status`, { status, note }),
  refund: (id: string, reason: string) =>
    api.post<{ order: AdminOrder; message: string }>(`/admin/orders/${id}/refund`, { reason }),
};

// ── Payouts ───────────────────────────────────────────────────────────────────

export const payoutsApi = {
  list: (status = 'pending', limit = 50, offset = 0) =>
    api.get<{ payouts: Payout[]; total: number; total_amount: number }>(
      `/admin/payouts?status=${status}&limit=${limit}&offset=${offset}`
    ),
  process: (id: string, bank_reference?: string) =>
    api.patch<{ payout: Payout }>(`/admin/payouts/${id}/process`, { bank_reference }),
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export const reviewsApi = {
  list: (params: { flagged?: boolean; q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params.flagged) q.set('flagged', 'true');
    if (params.q) q.set('q', params.q);
    q.set('limit', String(params.limit ?? 50));
    q.set('offset', String(params.offset ?? 0));
    return api.get<{ reviews: Review[] }>(`/admin/reviews?${q}`);
  },
  flag: (id: string, flagged: boolean) =>
    api.patch<{ review: Review }>(`/admin/reviews/${id}/flag`, { flagged }),
  remove: (id: string) => api.delete<{ message: string }>(`/admin/reviews/${id}`),
};

// ── Config ────────────────────────────────────────────────────────────────────

export const configApi = {
  get: () => api.get<{ platform_fee_rate: number; country_configs: CountryConfig[] }>('/admin/config'),
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

export interface StatsOverview {
  total_users: number;
  total_active_cooks: number;
  orders_by_status: Record<string, number>;
  total_orders: number;
  platform_revenue: number;
  pending_payout_amount: number;
  pending_payout_count: number;
  pending_verifications: number;
}

export interface ChartRow {
  day: string;
  orders: number;
  revenue: number;
}

export interface AdminCook {
  id: string;
  display_name: string;
  username: string;
  location: string;
  is_live: boolean;
  is_active: boolean;
  food_safety_verified: boolean;
  id_verified: boolean;
  verification_status: string;
  average_rating: number;
  total_orders: number;
  platform_follower_count: number;
  created_at: string;
  phone: string;
  email: string | null;
  full_name: string;
}

export interface AdminCookDetail extends AdminCook {
  joined_at: string;
}

export interface CookStats {
  total_orders: number;
  total_earned: number;
}

export interface OrderSummary {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export interface CookListParams {
  q?: string;
  status?: 'active' | 'suspended';
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export interface AdminCustomer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  total_orders: number;
  total_spent: number;
}

export interface AdminOrder {
  id: string;
  status: string;
  total_amount: number;
  platform_fee: number;
  cook_payout: number;
  cook_name: string;
  customer_name: string;
  customer_phone: string;
  item_title: string;
  created_at: string;
  payment_tx_ref: string | null;
  customer_id: string;
}

export interface OrderListParams {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface Payout {
  id: string;
  cook_id: string;
  amount: number;
  currency_code: string;
  status: string;
  bank_reference: string | null;
  processed_at: string | null;
  created_at: string;
  cook_name: string;
  cook_username: string;
  cook_phone: string;
}

export interface Review {
  id: string;
  cook_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  is_flagged: boolean;
  created_at: string;
  cook_name: string;
  customer_name: string;
}

export interface CountryConfig {
  id: string;
  country_code: string;
  country_name: string;
  currency_code: string;
  currency_symbol: string;
  is_active: boolean;
}
