import * as ImagePicker from 'expo-image-picker';
import { api } from '../api/client';

export interface PickResult {
  uri: string;
  base64: string;
  mimeType: string;
}

/** Open the device image library and return base64 + URI. */
export async function pickImage(): Promise<PickResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (!asset.base64) return null;

  return {
    uri: asset.uri,
    base64: asset.base64,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

/** Open the camera and return base64 + URI. */
export async function takePhoto(): Promise<PickResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (!asset.base64) return null;

  return {
    uri: asset.uri,
    base64: asset.base64,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

export interface UploadResult {
  url: string;
  public_id?: string;
}

/** Upload a picked/taken image to the backend and return the hosted URL + Cloudinary public_id. */
export async function uploadImage(picked: PickResult, folder = 'foodsbyme'): Promise<UploadResult> {
  const dataUri = `data:${picked.mimeType};base64,${picked.base64}`;
  return api.post<UploadResult>('/upload', { image: dataUri, folder });
}
