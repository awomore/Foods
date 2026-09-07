import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { uploadApi } from '../api/upload';

export interface PickResult {
  uri: string;
  /** Kept for callers that still read it; no longer requested from the picker. */
  base64?: string;
  mimeType: string;
}

/** Open the device image library and return the picked asset's URI. */
export async function pickImage(): Promise<PickResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}

/** Open the camera and return the captured photo's URI. */
export async function takePhoto(): Promise<PickResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  return { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' };
}

export interface UploadResult {
  url: string;
  public_id?: string;
}

// A phone photo is 2–5 MB; sending it as base64 in a JSON body (the old path)
// inflated it ~33 % and routinely blew the request timeout on a mobile uplink.
// Downscale to a sane bound and re-encode before upload — an avatar or post
// image does not need more — then send it as a streamed multipart file.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;

async function shrink(uri: string): Promise<{ uri: string }> {
  try {
    const out = await manipulateAsync(uri, [{ resize: { width: MAX_EDGE } }], {
      compress: JPEG_QUALITY,
      format: SaveFormat.JPEG,
    });
    return { uri: out.uri };
  } catch {
    // Odd source format / manipulator failure — upload the original rather than block the user.
    return { uri };
  }
}

/** Resize a picked/taken image and upload it. Returns the hosted URL + Cloudinary public_id. */
export async function uploadImage(picked: PickResult, folder = 'foodsbyme'): Promise<UploadResult> {
  const { uri } = await shrink(picked.uri);
  const form = new FormData();
  form.append('file', { uri, name: 'upload.jpg', type: 'image/jpeg' } as any);
  form.append('folder', folder);
  return uploadApi.upload(form);
}
