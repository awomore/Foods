const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');
const { authenticate } = require('../middleware/auth');

// ── Cloudinary SDK initialisation (lazy per-request guard kept for safety) ────
function initCloudinary() {
  const name   = process.env.CLOUDINARY_CLOUD_NAME;
  const key    = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!name || !key || !secret) return null;
  cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });
  return cloudinary;
}

// ── MIME allowlists ───────────────────────────────────────────────────────────
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg']);

// ── Multer instances ──────────────────────────────────────────────────────────
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.has(file.mimetype)) return cb(null, true);
    const err = new Error(`Unsupported image type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, GIF.`);
    err.status = 400;
    cb(err);
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (VIDEO_MIMES.has(file.mimetype)) return cb(null, true);
    const err = new Error(`Unsupported video type: ${file.mimetype}. Allowed: MP4, MOV, WEBM.`);
    err.status = 400;
    cb(err);
  },
});

// ── Per-user rate limiter (10 uploads / minute) ───────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  message: { error: 'Too many uploads. Please wait a moment before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Wrap multer to surface its errors as JSON ─────────────────────────────────
function withMulter(multerFn) {
  return (req, res, next) => {
    multerFn(req, res, (err) => {
      if (!err) return next();
      const status = err.status ?? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum: 20 MB for images, 50 MB for videos.'
        : err.message;
      res.status(status).json({ error: message });
    });
  };
}

// ── Stream a Buffer to Cloudinary upload_stream ───────────────────────────────
function streamBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

// ── POST /api/upload — base64 data URI ───────────────────────────────────────
// Body: { image: 'data:image/jpeg;base64,...', folder?: string }
// Returns: { url, public_id }
router.post('/', authenticate, uploadLimiter, async (req, res) => {
  const cld = initCloudinary();
  if (!cld) {
    return res.status(503).json({ error: 'Image upload not configured. Set Cloudinary env vars.' });
  }

  const { image, folder = 'foodsbyme' } = req.body;
  if (!image) return res.status(400).json({ error: 'image is required (base64 data URI)' });

  const mimeMatch = image.match(/^data:([^;]+);base64,/);
  if (!mimeMatch || !IMAGE_MIMES.has(mimeMatch[1])) {
    return res.status(400).json({
      error: `Unsupported image type: ${mimeMatch?.[1] ?? 'unknown'}. Allowed: JPEG, PNG, WEBP, GIF.`,
    });
  }

  try {
    const result = await cld.uploader.upload(image, { folder, resource_type: 'image' });
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error('[upload] base64 failed', {
      user_id: req.user?.id,
      folder,
      mime: mimeMatch[1],
      error: err.message ?? err,
    });
    res.status(502).json({ error: err.message ?? 'Upload failed' });
  }
});

// ── POST /api/upload/multipart — FormData image ───────────────────────────────
// Field: 'file' (image)  Body field: folder?
// Returns: { url, public_id }
router.post(
  '/multipart',
  authenticate,
  uploadLimiter,
  withMulter(imageUpload.single('file')),
  async (req, res) => {
    const cld = initCloudinary();
    if (!cld) return res.status(503).json({ error: 'Upload not configured. Set Cloudinary env vars.' });
    if (!req.file) return res.status(400).json({ error: 'file required (multipart field: "file")' });

    const folder = req.body.folder ?? 'foodsbyme';
    try {
      const result = await streamBuffer(req.file.buffer, { folder, resource_type: 'image' });
      res.json({ url: result.secure_url, public_id: result.public_id });
    } catch (err) {
      console.error('[upload] multipart failed', {
        user_id: req.user?.id,
        folder,
        size: req.file.size,
        mime: req.file.mimetype,
        error: err.message ?? err,
      });
      res.status(502).json({ error: err.message ?? 'Upload failed' });
    }
  }
);

// ── POST /api/upload/video — FormData video ───────────────────────────────────
// Field: 'video'  Body field: folder?
// Returns: { url, public_id }
router.post(
  '/video',
  authenticate,
  uploadLimiter,
  withMulter(videoUpload.single('video')),
  async (req, res) => {
    const cld = initCloudinary();
    if (!cld) return res.status(503).json({ error: 'Upload not configured' });
    if (!req.file) return res.status(400).json({ error: 'video file required' });

    // Default to 'foodsbyme' — callers pass explicit folder (e.g. 'stories')
    const folder = req.body.folder ?? 'foodsbyme';
    try {
      const result = await streamBuffer(req.file.buffer, { folder, resource_type: 'video' });
      res.json({ url: result.secure_url, public_id: result.public_id });
    } catch (err) {
      console.error('[upload] video failed', {
        user_id: req.user?.id,
        folder,
        size: req.file.size,
        mime: req.file.mimetype,
        error: err.message ?? err,
      });
      res.status(502).json({ error: err.message ?? 'Video upload failed' });
    }
  }
);

module.exports = router;
