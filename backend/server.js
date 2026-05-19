require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // allow non-browser clients (mobile, curl) and known web origins
    if (!origin) return cb(null, true);
    const allowed = /localhost|\.railway\.app|\.vercel\.app|foodsbyme\.com/;
    cb(null, allowed.test(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,                    // per IP
  message: { error: 'Too many requests. Please try again shortly.' }
});
app.use('/api/', limiter);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cooks', require('./routes/cooks'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/discover', require('./routes/discover'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/follows', require('./routes/follows'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/custom-requests', require('./routes/customRequests'));
app.use('/api/private-chef', require('./routes/privateChef'));
app.use('/api/bulk-requests', require('./routes/bulkRequests'));
app.use('/api/gifting', require('./routes/gifting'));
app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/earnings', require('./routes/earnings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/diary', require('./routes/diary'));
app.use('/api/community', require('./routes/community'));
app.use('/api/health', require('./routes/health'));
app.use('/api/chop-talk', require('./routes/chopTalk'));
app.use('/api/tips', require('./routes/tips'));
app.use('/api/admin', require('./routes/admin'));

// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', platform: 'FOODSbyme', timestamp: new Date().toISOString() });
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ── Start server + scheduler ───────────────────────────────
const scheduler = require('./services/scheduler');

app.listen(PORT, () => {
  console.log(`FOODSbyme API running on port ${PORT}`);
  scheduler.start();
});

module.exports = app;
