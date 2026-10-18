'use strict';

const { v2: cloudinary } = require('cloudinary');

/**
 * Identity documents are stored in Cloudinary as *authenticated* assets: they
 * have no public URL, unlike everything routes/upload.js stores. The only way to
 * see one is a time-limited download URL minted here for an admin.
 */

function configured() {
  const { CLOUDINARY_CLOUD_NAME: name, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!name || !key || !secret) return null;
  cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });
  return cloudinary;
}

const IMAGE_DATA_URI = /^data:image\/(jpeg|png|webp);base64,/;

/**
 * Store a base64 image data URI privately. Always stored as JPEG, so the
 * download URL never needs to know the original format.
 * @returns {Promise<string>} the asset's public_id
 */
async function storePrivateImage(dataUri, folder) {
  const cld = configured();
  if (!cld) throw Object.assign(new Error('Document upload is not configured'), { status: 503 });
  if (!IMAGE_DATA_URI.test(String(dataUri ?? ''))) {
    throw Object.assign(new Error('The ID photo must be a JPEG, PNG or WEBP image'), { status: 400 });
  }
  const result = await cld.uploader.upload(dataUri, {
    folder, type: 'authenticated', resource_type: 'image', format: 'jpg',
  });
  return result.public_id;
}

/** A download URL for a private document, valid for `ttlSeconds`. */
function privateImageUrl(publicId, ttlSeconds = 600) {
  const cld = configured();
  if (!cld || !publicId) return null;
  return cld.utils.private_download_url(publicId, 'jpg', {
    type: 'authenticated', resource_type: 'image',
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}

module.exports = { storePrivateImage, privateImageUrl };
