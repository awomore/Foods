const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/upload
 * Body: { image: 'data:image/jpeg;base64,...', folder?: string }
 * Returns: { url }
 *
 * Requires env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * If Cloudinary is not configured, returns a 503 with a helpful message.
 */
router.post('/', authenticate, async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({
      error: 'Image upload not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env',
    });
  }

  const { image, folder = 'foodsbyme' } = req.body;
  if (!image) return res.status(400).json({ error: 'image is required (base64 data URI)' });

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha1')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    const body = new URLSearchParams({
      file:      image,
      api_key:   apiKey,
      timestamp: String(timestamp),
      signature,
      folder,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Cloudinary error:', err);
      return res.status(502).json({ error: err.error?.message ?? 'Upload failed' });
    }

    const data = await response.json();
    res.json({ url: data.secure_url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
