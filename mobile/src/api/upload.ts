import * as SecureStore from 'expo-secure-store';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-api-production.up.railway.app') + '/api';

// Uploads carry a real payload over a mobile uplink, so they get a longer
// ceiling than a normal API call and a friendlier message when the socket drops.
const UPLOAD_TIMEOUT_MS = 60_000;

export interface UploadResponse {
  url: string;
  public_id?: string;
}

async function postUpload(path: string, body: BodyInit, jsonHeaders = false): Promise<UploadResponse> {
  const token = await SecureStore.getItemAsync('auth_token');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (jsonHeaders) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body, signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new Error('Upload timed out. Check your connection and try again.');
    }
    const msg: string = err?.message ?? '';
    if (msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('network')) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
    throw err;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error ?? 'Upload failed. Please try again.'), { status: res.status });
  }
  return res.json();
}

export const uploadApi = {
  // Upload an image via multipart FormData (field: 'file'). Returns { url, public_id }.
  upload: (formData: FormData): Promise<UploadResponse> => postUpload('/upload/multipart', formData as any),

  // Upload a video via multipart FormData (field: 'video'). Returns { url, public_id }.
  uploadVideo: (formData: FormData): Promise<UploadResponse> => postUpload('/upload/video', formData as any),

  // Upload a base64 data URI (JSON body). Returns { url, public_id }.
  uploadBase64: (dataUri: string, folder = 'foodsbyme'): Promise<UploadResponse> =>
    postUpload('/upload', JSON.stringify({ image: dataUri, folder }), true),
};
