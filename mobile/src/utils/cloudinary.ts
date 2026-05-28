/**
 * Cloudinary URL transformation utilities.
 *
 * Cloudinary CDN URLs follow the pattern:
 *   https://res.cloudinary.com/{cloud}/image/upload/{public_id_and_version}
 *
 * We insert transformation parameters between /upload/ and the resource path.
 * Non-Cloudinary URLs are returned as-is so the rest of the app stays clean.
 */

const CLOUDINARY_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

function buildTransform(parts: string[]): string {
  return parts.filter(Boolean).join(',');
}

function inject(uri: string, transform: string): string {
  const m = uri.match(CLOUDINARY_RE);
  if (!m || !transform) return uri;
  return `${m[1]}${transform}/${m[2]}`;
}

/** General-purpose Cloudinary transformer. Returns null for null/undefined input. */
export function clImage(
  uri: string | null | undefined,
  opts: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'crop' | 'thumb' | 'limit';
    gravity?: 'face' | 'center' | 'auto' | 'faces';
    quality?: number | 'auto';
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
    radius?: number | 'max';
    blur?: number;
    dpr?: 'auto' | number;
  } = {}
): string | null {
  if (!uri) return null;
  const parts: string[] = [];
  if (opts.width)               parts.push(`w_${opts.width}`);
  if (opts.height)              parts.push(`h_${opts.height}`);
  if (opts.crop)                parts.push(`c_${opts.crop}`);
  if (opts.gravity)             parts.push(`g_${opts.gravity}`);
  if (opts.quality !== undefined) parts.push(`q_${opts.quality}`);
  if (opts.format)              parts.push(`f_${opts.format}`);
  if (opts.radius !== undefined) parts.push(`r_${opts.radius}`);
  if (opts.blur !== undefined)  parts.push(`e_blur:${opts.blur}`);
  if (opts.dpr !== undefined)   parts.push(`dpr_${opts.dpr}`);
  const transform = buildTransform(parts);
  return inject(uri, transform);
}

/**
 * Optimised dish / food photo.
 * Responsive width, auto format (AVIF/WebP), auto quality.
 */
export function dishPhoto(
  uri: string | null | undefined,
  width = 800
): string | null {
  return clImage(uri, {
    width,
    crop: 'fill',
    gravity: 'center',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  });
}

/**
 * Avatar circle crop using face-detection gravity.
 * Pass size * 2 for retina renders.
 */
export function avatarPhoto(
  uri: string | null | undefined,
  size = 200
): string | null {
  return clImage(uri, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'face',
    quality: 'auto',
    format: 'auto',
  });
}

/**
 * Kitchen / banner hero photo — wide, auto-format, good quality.
 */
export function kitchenPhoto(
  uri: string | null | undefined,
  width = 1200
): string | null {
  return clImage(uri, {
    width,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    format: 'auto',
    dpr: 'auto',
  });
}

/**
 * Tiny blurred placeholder for a progressive-loading feel
 * when a full blurhash string is not available.
 */
export function blurThumb(uri: string | null | undefined): string | null {
  return clImage(uri, {
    width: 32,
    crop: 'fill',
    quality: 30,
    format: 'auto',
    blur: 1000,
  });
}
