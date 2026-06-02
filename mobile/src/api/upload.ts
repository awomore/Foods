import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://foodsbyme-production.up.railway.app') + '/api';

export const uploadApi = {
  // Upload a file via multipart FormData. The server returns { url: string }.
  upload: async (formData: FormData): Promise<{ url: string }> => {
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

  // Upload a base64 data URI (JSON body). Server returns { url: string }.
  uploadBase64: async (dataUri: string, folder = 'foodsbyme'): Promise<{ url: string }> => {
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
