const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');

const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

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

// ── POST /api/upload/multipart — multipart/form-data image upload ─────────────
// Accepts a 'file' field from FormData (mobile ImagePicker)
router.post('/multipart', authenticate, memUpload.single('file'), async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Upload not configured. Set Cloudinary env vars.' });
  }
  if (!req.file) return res.status(400).json({ error: 'file required (multipart field: "file")' });

  try {
    const folder    = req.body.folder ?? 'foodsbyme';
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    form.append('file', blob, req.file.originalname ?? 'image.jpg');
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: form }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message ?? 'Upload failed' });
    }
    const data = await response.json();
    res.json({ url: data.secure_url });
  } catch (err) {
    console.error('Multipart upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── POST /api/upload/video ───────────────────────────────────────────────────
// Accepts multipart/form-data with field 'video' and optional 'folder'.
router.post('/video', authenticate, memUpload.single('video'), async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Upload not configured' });
  }
  if (!req.file) return res.status(400).json({ error: 'video file required' });

  try {
    const folder    = req.body.folder ?? 'stories';
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + apiSecret).digest('hex');

    const form = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    form.append('file', blob, req.file.originalname ?? 'video.mp4');
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      { method: 'POST', body: form }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message ?? 'Video upload failed' });
    }

    const data = await response.json();
    res.json({ url: data.secure_url });
  } catch (err) {
    console.error('Video upload error:', err);
    res.status(500).json({ error: 'Video upload failed' });
  }
});

module.exports = router;
