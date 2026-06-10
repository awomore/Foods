import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-api-production.up.railway.app') + '/api';

export interface UploadResponse {
  url: string;
  public_id?: string;
}

export const uploadApi = {
  // Upload an image via multipart FormData (field: 'file'). Returns { url, public_id }.
  upload: async (formData: FormData): Promise<UploadResponse> => {
    const token = await AsyncStorage.getItem('auth_token');
    const res = await fetch(`${BASE_URL}/upload/multipart`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { error: err.error ?? 'Upload failed', status: res.status };
    }
    return res.json();
  },

  // Upload a video via multipart FormData (field: 'video'). Returns { url, public_id }.
  uploadVideo: async (formData: FormData): Promise<UploadResponse> => {
    const token = await AsyncStorage.getItem('auth_token');
    const res = await fetch(`${BASE_URL}/upload/video`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { error: err.error ?? 'Upload failed', status: res.status };
    }
    return res.json();
  },

  // Upload a base64 data URI (JSON body). Returns { url, public_id }.
  uploadBase64: async (dataUri: string, folder = 'foodsbyme'): Promise<UploadResponse> => {
    const token = await AsyncStorage.getItem('auth_token');
    const res = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ image: dataUri, folder }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { error: err.error ?? 'Upload failed', status: res.status };
    }
    return res.json();
  },
};
