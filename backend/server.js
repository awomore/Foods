require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.set('trust proxy', 1); // Railway sits behind a proxy; needed for rate-limit IP detection
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
app.use('/api/discounts', require('./routes/discounts'));
app.use('/api/cravings', require('./routes/cravings'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));

// ── Craving share card  GET /c/:id ────────────────────────────────────────
// Serves a web page with OG tags so WhatsApp/social previews look great.
// Two CTAs deep-link back into the app.
app.get('/c/:id', async (req, res) => {
  const { sql } = require('./supabase/db');
  const BASE = process.env.APP_BASE_URL ?? 'https://foodsbyme-production.up.railway.app';
  const APP_SCHEME = 'foodsbyme';

  try {
    const rows = await sql`
      SELECT c.id, c.dish_title, c.dish_price, c.dish_photo, c.currency_code,
             c.is_fulfilled, c.cook_id, c.user_id,
             u.full_name AS user_name,
             cp.display_name AS cook_name
      FROM cravings c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN cook_profiles cp ON cp.id = c.cook_id
      WHERE c.id = ${req.params.id} AND c.is_public = true
    `;

    if (!rows.length) {
      return res.status(404).send('<h2>Craving not found or no longer active.</h2>');
    }

    const c = rows[0];
    const firstName = (c.user_name ?? 'Someone').split(' ')[0];
    const price = c.dish_price
      ? new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(c.dish_price)
      : null;
    const priceStr = price ? ` · ${c.currency_code === 'NGN' ? '₦' : c.currency_code + ' '}${price}` : '';

    const title = `${firstName} is craving ${c.dish_title}!`;
    const description = `Gift ${firstName} this dish${priceStr}, or order it for yourself on FOODSbyme.`;
    const imageUrl = c.dish_photo ?? `${BASE}/og-default.png`;

    // Deep links
    const giftLink  = `${APP_SCHEME}://profile/${c.user_id}`;
    const orderLink = c.cook_id ? `${APP_SCHEME}://cook/${c.cook_id}` : `${APP_SCHEME}://`;

    // Fulfilled state
    if (c.is_fulfilled) {
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>${firstName}'s craving has been fulfilled!</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAF6F0;color:#1A1009;padding:24px;text-align:center}
        h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#7A6652}a{display:inline-block;margin-top:24px;background:#C97A35;color:#fff;padding:14px 28px;border-radius:40px;text-decoration:none;font-weight:600}
        </style></head><body>
        <div style="font-size:3rem">🎉</div>
        <h1>${firstName}'s craving has already been fulfilled!</h1>
        <p>${c.dish_title} was gifted to them.</p>
        <a href="${orderLink}">Order it for yourself on FOODSbyme</a>
        </body></html>`);
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>

  <!-- Open Graph / WhatsApp / iMessage -->
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image"       content="${imageUrl}">
  <meta property="og:url"         content="${BASE}/c/${c.id}">
  <meta property="og:site_name"   content="FOODSbyme">

  <!-- Twitter card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image"       content="${imageUrl}">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #FAF6F0;
      color: #1A1009;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .hero {
      width: 100%;
      max-width: 480px;
      aspect-ratio: 4/3;
      object-fit: cover;
      background: #C97A35;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .hero img { width: 100%; height: 100%; object-fit: cover; }
    .hero-placeholder { font-size: 4rem; }
    .card {
      width: 100%;
      max-width: 480px;
      padding: 24px 20px 40px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #FDF2E8;
      border: 1px solid #EDCFAA;
      color: #C97A35;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 40px;
      width: fit-content;
      margin-bottom: 4px;
    }
    h1 { font-size: 1.5rem; font-weight: 700; line-height: 1.3; }
    .price { font-size: 1.3rem; color: #C97A35; font-weight: 700; margin-top: 4px; }
    .sub { font-size: 0.875rem; color: #7A6652; line-height: 1.5; margin-top: 8px; }
    .btns { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
    .btn-gift {
      background: #1A1009;
      color: #FAF6F0;
      text-decoration: none;
      border-radius: 14px;
      padding: 16px 20px;
      text-align: center;
      font-weight: 600;
      font-size: 1rem;
    }
    .btn-self {
      background: #FAF6F0;
      color: #1A1009;
      text-decoration: none;
      border-radius: 14px;
      padding: 16px 20px;
      text-align: center;
      font-weight: 600;
      font-size: 1rem;
      border: 1.5px solid #EDCFAA;
    }
    .footer {
      margin-top: 32px;
      font-size: 11px;
      color: #B09A86;
      text-align: center;
      padding-bottom: 24px;
    }
  </style>
</head>
<body>
  <div class="hero">
    ${c.dish_photo
      ? `<img src="${c.dish_photo}" alt="${c.dish_title}" loading="lazy">`
      : `<span class="hero-placeholder">🍽️</span>`}
  </div>

  <div class="card">
    <div class="badge">❤️ Craving</div>
    <h1>${c.dish_title}</h1>
    ${price ? `<div class="price">${c.currency_code === 'NGN' ? '₦' : c.currency_code + ' '}${price}</div>` : ''}
    <p class="sub">${firstName} wants this${c.cook_name ? ' from ' + c.cook_name : ''}. You can gift it to them, or order it for yourself — both on FOODSbyme.</p>

    <div class="btns">
      <a class="btn-gift" href="${giftLink}">🎁 Gift this to ${firstName}</a>
      <a class="btn-self" href="${orderLink}">Order it for myself</a>
    </div>
  </div>

  <div class="footer">
    Shared via <strong>FOODSbyme</strong> · Home-cooked meals from real cooks near you
  </div>

  <script>
    // Try to open the app immediately if on mobile
    // Falls back gracefully if app not installed
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|iphone|ipad/.test(ua);
    if (isMobile) {
      document.querySelectorAll('a[href^="${APP_SCHEME}://"]').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          window.location.href = a.href;
          // Fallback: if still here after 1.5s, show app store prompt
          setTimeout(() => {
            const dl = /iphone|ipad/.test(ua)
              ? 'https://apps.apple.com/app/foodsbyme'
              : 'https://play.google.com/store/apps/details?id=com.skodztest.foodsbyme';
            if (!document.hidden) window.location.href = dl;
          }, 1500);
        });
      });
    }
  </script>
</body>
</html>`);

  } catch (err) {
    console.error('Share card error:', err);
    res.status(500).send('<h2>Something went wrong.</h2>');
  }
});

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
