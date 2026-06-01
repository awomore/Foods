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
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/social-verify', require('./routes/socialVerify'));
app.use('/api/stories',          require('./routes/stories').router);
app.use('/api/analytics',        require('./routes/analytics'));
app.use('/api/certifications',   require('./routes/certifications'));
app.use('/api/disputes',         require('./routes/disputes'));
app.use('/api/escrow',           require('./routes/escrow'));
app.use('/api/chef-availability',require('./routes/chefAvailability'));
app.use('/api/catering',         require('./routes/catering'));
app.use('/api/courses',          require('./routes/courses'));
app.use('/api/digital-products', require('./routes/digitalProducts'));
app.use('/api/invoices',         require('./routes/invoices'));
app.use('/api/quotations',       require('./routes/quotations'));
app.use('/api/weekly-menus',     require('./routes/weeklyMenus'));
app.use('/api/subscriptions',    require('./routes/subscriptions'));
app.use('/api/affiliate',        require('./routes/affiliate'));
app.use('/api/search',                require('./routes/search'));
app.use('/api/creator-branding',      require('./routes/creatorBranding'));
app.use('/api/customer-posts',        require('./routes/customerPosts'));
app.use('/api/chef-service-settings', require('./routes/chefServiceSettings'));
app.use('/api/video-views',           require('./routes/videoTracking'));

// ── POST /api/social/track — social conversion event (no auth required) ────
app.post('/api/social/track', async (req, res) => {
  const { sql } = require('./supabase/db');
  const { event_type, entity_type, entity_slug, source } = req.body;
  const VALID_EVENTS   = ['social_click','social_visit','social_follow','social_order','social_conversion'];
  const VALID_ENTITIES = ['creator','dish','course','service','menu'];
  const VALID_SOURCES  = ['whatsapp','x','instagram','facebook','other'];

  if (!VALID_EVENTS.includes(event_type)) {
    return res.status(400).json({ error: 'Invalid event_type' });
  }
  try {
    const ipRaw  = req.ip ?? req.socket?.remoteAddress ?? '';
    const crypto = require('crypto');
    const ipHash = crypto.createHash('sha256').update(ipRaw).digest('hex').slice(0, 16);
    const referrer = req.get('Referer') ?? null;

    await sql`
      INSERT INTO social_conversions (event_type, entity_type, entity_slug, source, ip_hash, referrer)
      VALUES (
        ${event_type},
        ${VALID_ENTITIES.includes(entity_type) ? entity_type : null},
        ${entity_slug ?? null},
        ${VALID_SOURCES.includes(source) ? source : 'other'},
        ${ipHash},
        ${referrer}
      )
    `;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// ── Deep link helpers ──────────────────────────────────────────────────────
const BASE_URL = () => process.env.APP_BASE_URL ?? 'https://foodsbyme-production.up.railway.app';
const APP_SCHEME = 'foodsbyme';

function deepLinkPage({ title, description, imageUrl, appUrl, webUrl, badgeLabel, badgeEmoji, cta, secondaryCta, entityType, entitySlug }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — FOODSbyme</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${webUrl}">
  <meta property="og:site_name" content="FOODSbyme">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF6F0;color:#1A1009;min-height:100vh;display:flex;flex-direction:column;align-items:center}
    .hero{width:100%;max-width:480px;aspect-ratio:4/3;overflow:hidden;background:#C97A35;display:flex;align-items:center;justify-content:center}
    .hero img{width:100%;height:100%;object-fit:cover}
    .hero-ph{font-size:4rem}
    .card{width:100%;max-width:480px;padding:24px 20px 40px;display:flex;flex-direction:column;gap:8px}
    .badge{display:inline-flex;align-items:center;gap:6px;background:#FDF2E8;border:1px solid #EDCFAA;color:#C97A35;font-size:12px;font-weight:600;padding:4px 12px;border-radius:40px;width:fit-content;margin-bottom:4px}
    h1{font-size:1.5rem;font-weight:700;line-height:1.3}
    .sub{font-size:.875rem;color:#7A6652;line-height:1.5;margin-top:8px}
    .btns{display:flex;flex-direction:column;gap:10px;margin-top:24px}
    .btn-primary{background:#1A1009;color:#FAF6F0;text-decoration:none;border-radius:14px;padding:16px 20px;text-align:center;font-weight:600;font-size:1rem;display:block}
    .btn-secondary{background:#FAF6F0;color:#1A1009;text-decoration:none;border-radius:14px;padding:16px 20px;text-align:center;font-weight:600;font-size:1rem;border:1.5px solid #EDCFAA;display:block}
    .footer{margin-top:32px;font-size:11px;color:#B09A86;text-align:center;padding-bottom:24px}
    .foods-badge{margin-top:16px;padding:10px 16px;background:#FDF2E8;border-radius:40px;font-size:11px;color:#7A6652;text-align:center}
  </style>
</head>
<body>
  <div class="hero">
    ${imageUrl && imageUrl !== BASE_URL() + '/og-default.png'
      ? `<img src="${imageUrl}" alt="${title}" loading="lazy">`
      : `<span class="hero-ph">${badgeEmoji}</span>`}
  </div>
  <div class="card">
    <div class="badge">${badgeEmoji} ${badgeLabel}</div>
    <h1>${title}</h1>
    <p class="sub">${description}</p>
    <p class="sub foods-badge">Powered by <strong>FOODSbyme</strong> · Real food from real creators</p>
    <div class="btns">
      <a class="btn-primary" href="${appUrl}">${cta}</a>
      ${secondaryCta ? `<a class="btn-secondary" href="${secondaryCta.url}">${secondaryCta.label}</a>` : ''}
    </div>
  </div>
  <div class="footer">Shared via <strong>FOODSbyme</strong></div>
  <script>
    // Social conversion tracking
    (function() {
      const ref = document.referrer || '';
      const source = /whatsapp/.test(ref) ? 'whatsapp'
        : /t\.co|twitter|x\.com/.test(ref) ? 'x'
        : /instagram/.test(ref) ? 'instagram'
        : /facebook|fb\.com/.test(ref) ? 'facebook'
        : 'other';
      fetch('/api/social/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'social_visit',
          entity_type: '${entityType ?? ''}',
          entity_slug: '${entitySlug ?? ''}',
          source,
        }),
      }).catch(() => {});

      // Track clicks on the primary CTA
      const primaryBtn = document.querySelector('.btn-primary');
      if (primaryBtn) {
        primaryBtn.addEventListener('click', () => {
          fetch('/api/social/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_type: 'social_click',
              entity_type: '${entityType ?? ''}',
              entity_slug: '${entitySlug ?? ''}',
              source,
            }),
          }).catch(() => {});
        });
      }
    })();

    const ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad/.test(ua)) {
      document.querySelectorAll('a[href^="${APP_SCHEME}://"]').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          window.location.href = a.href;
          setTimeout(() => {
            if (!document.hidden) {
              window.location.href = /iphone|ipad/.test(ua)
                ? 'https://apps.apple.com/app/foodsbyme'
                : 'https://play.google.com/store/apps/details?id=com.skodztest.foodsbyme';
            }
          }, 1500);
        });
      });
    }
  </script>
</body>
</html>`;
}

// ── GET /creator/:slug ─────────────────────────────────────────────────────
app.get('/creator/:slug', async (req, res) => {
  const { sql } = require('./supabase/db');
  const BASE = BASE_URL();
  try {
    const rows = await sql`
      SELECT cp.id, cp.display_name, cp.avatar_url, cp.bio,
             cp.cover_image, cp.average_rating, cp.platform_follower_count,
             cp.creator_types, cp.profile_slug
      FROM cook_profiles cp
      WHERE cp.profile_slug = ${req.params.slug} AND cp.is_active = true
    `;
    if (!rows.length) return res.status(404).send('<h2>Creator not found.</h2>');
    const c = rows[0];
    const typeLabel = (c.creator_types?.[0] ?? 'creator').replace(/_/g, ' ');
    res.send(deepLinkPage({
      title: c.display_name,
      description: c.bio ?? `${c.display_name} is a ${typeLabel} on FOODSbyme.`,
      imageUrl: c.cover_image ?? c.avatar_url ?? `${BASE}/og-default.png`,
      appUrl: `${APP_SCHEME}://cook/${c.id}`,
      webUrl: `${BASE}/creator/${c.profile_slug}`,
      badgeLabel: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1),
      badgeEmoji: '👨‍🍳',
      cta: `View ${c.display_name} on FOODSbyme`,
      secondaryCta: null,
      entityType: 'creator',
      entitySlug: c.profile_slug,
    }));
  } catch (err) {
    res.status(500).send('<h2>Something went wrong.</h2>');
  }
});

// ── GET /dish/:slug ────────────────────────────────────────────────────────
app.get('/dish/:slug', async (req, res) => {
  const { sql } = require('./supabase/db');
  const BASE = BASE_URL();
  try {
    const rows = await sql`
      SELECT mi.id, mi.title, mi.description, mi.photos[1] AS image,
             mi.unit_price, mi.currency_code,
             cp.display_name AS cook_name, cp.id AS cook_id, cp.profile_slug AS cook_slug
      FROM menu_items mi
      JOIN cook_profiles cp ON cp.id = mi.cook_id
      WHERE mi.slug = ${req.params.slug} AND mi.is_active = true
    `;
    if (!rows.length) return res.status(404).send('<h2>Dish not found.</h2>');
    const d = rows[0];
    const price = d.unit_price
      ? `₦${new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(d.unit_price)}`
      : '';
    res.send(deepLinkPage({
      title: d.title,
      description: `${d.description ?? ''} ${price ? '· ' + price : ''} by ${d.cook_name}`.trim(),
      imageUrl: d.image ?? `${BASE}/og-default.png`,
      appUrl: `${APP_SCHEME}://item/${d.id}`,
      webUrl: `${BASE}/dish/${req.params.slug}`,
      badgeLabel: 'Dish',
      badgeEmoji: '🍽️',
      cta: 'Order on FOODSbyme',
      secondaryCta: d.cook_slug
        ? { url: `${APP_SCHEME}://cook/${d.cook_id}`, label: `View ${d.cook_name}'s kitchen` }
        : null,
      entityType: 'dish',
      entitySlug: req.params.slug,
    }));
  } catch (err) {
    res.status(500).send('<h2>Something went wrong.</h2>');
  }
});

// ── GET /course/:slug ──────────────────────────────────────────────────────
app.get('/course/:slug', async (req, res) => {
  const { sql } = require('./supabase/db');
  const BASE = BASE_URL();
  try {
    const rows = await sql`
      SELECT c.id, c.title, c.description, c.cover_image, c.price, c.is_free,
             c.lesson_count, c.enrollment_count,
             cp.display_name AS cook_name, cp.id AS cook_id
      FROM courses c
      JOIN cook_profiles cp ON cp.id = c.cook_id
      WHERE c.slug = ${req.params.slug} AND c.is_published = true
    `;
    if (!rows.length) return res.status(404).send('<h2>Course not found.</h2>');
    const c = rows[0];
    res.send(deepLinkPage({
      title: c.title,
      description: `${c.description ?? ''} · ${c.lesson_count ?? 0} lessons · ${c.enrollment_count ?? 0} enrolled · ${c.is_free ? 'Free' : '₦' + new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(c.price ?? 0)}`.trim(),
      imageUrl: c.cover_image ?? `${BASE}/og-default.png`,
      appUrl: `${APP_SCHEME}://course/${c.id}`,
      webUrl: `${BASE}/course/${req.params.slug}`,
      badgeLabel: 'Course',
      badgeEmoji: '🎓',
      cta: c.is_free ? 'Enrol for free' : 'Enrol on FOODSbyme',
      secondaryCta: null,
      entityType: 'course',
      entitySlug: req.params.slug,
    }));
  } catch (err) {
    res.status(500).send('<h2>Something went wrong.</h2>');
  }
});

// ── GET /service/:cookSlug ─────────────────────────────────────────────────
app.get('/service/:cookSlug', async (req, res) => {
  const { sql } = require('./supabase/db');
  const BASE = BASE_URL();
  try {
    const rows = await sql`
      SELECT cp.id, cp.display_name, cp.avatar_url, cp.bio,
             cp.accepts_private_chef, cp.accepts_catering,
             cp.max_guest_count, cp.service_regions, cp.profile_slug
      FROM cook_profiles cp
      WHERE cp.profile_slug = ${req.params.cookSlug} AND cp.is_active = true
    `;
    if (!rows.length) return res.status(404).send('<h2>Service not found.</h2>');
    const c = rows[0];
    const services = [
      c.accepts_private_chef && 'Private Chef',
      c.accepts_catering && 'Catering',
    ].filter(Boolean).join(' · ');
    res.send(deepLinkPage({
      title: `${c.display_name} — Services`,
      description: `Book ${c.display_name} for ${services}${c.service_regions?.length ? ' in ' + c.service_regions.slice(0,3).join(', ') : ''}`,
      imageUrl: c.avatar_url ?? `${BASE}/og-default.png`,
      appUrl: `${APP_SCHEME}://cook/${c.id}`,
      webUrl: `${BASE}/service/${req.params.cookSlug}`,
      badgeLabel: 'Service',
      badgeEmoji: '🛎️',
      cta: 'Book on FOODSbyme',
      secondaryCta: null,
    }));
  } catch (err) {
    res.status(500).send('<h2>Something went wrong.</h2>');
  }
});

// ── GET /menu/:slug ────────────────────────────────────────────────────────
app.get('/menu/:slug', async (req, res) => {
  const { sql } = require('./supabase/db');
  const BASE = BASE_URL();
  try {
    const rows = await sql`
      SELECT wm.id, wm.title, wm.description, wm.week_start, wm.items,
             cp.display_name AS cook_name, cp.id AS cook_id, cp.avatar_url
      FROM weekly_menus wm
      JOIN cook_profiles cp ON cp.id = wm.cook_id
      WHERE wm.slug = ${req.params.slug} AND wm.is_published = true
    `;
    if (!rows.length) return res.status(404).send('<h2>Menu not found.</h2>');
    const m = rows[0];
    const items = (m.items ?? []).slice(0, 3).map(i => i.name).join(', ');
    res.send(deepLinkPage({
      title: m.title ?? `Weekly Menu by ${m.cook_name}`,
      description: `${m.description ?? ''} This week: ${items}`.trim(),
      imageUrl: m.avatar_url ?? `${BASE}/og-default.png`,
      appUrl: `${APP_SCHEME}://cook/${m.cook_id}`,
      webUrl: `${BASE}/menu/${req.params.slug}`,
      badgeLabel: 'Weekly Menu',
      badgeEmoji: '📅',
      cta: 'View Menu on FOODSbyme',
      secondaryCta: null,
    }));
  } catch (err) {
    res.status(500).send('<h2>Something went wrong.</h2>');
  }
});

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
