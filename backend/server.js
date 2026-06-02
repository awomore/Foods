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

// ── Legal pages (required for TikTok / social platform app review) ─────────
app.get('/terms', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Service – FOODSbyme</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}h1{color:#e85d04}h2{margin-top:2em}</style></head><body>
<h1>FOODSbyme Terms of Service</h1>
<p><strong>Effective date:</strong> June 1, 2026</p>
<p>Welcome to FOODSbyme. By creating an account or using our platform you agree to these terms.</p>
<h2>1. The Platform</h2>
<p>FOODSbyme is a marketplace connecting home cooks and food creators with customers. Creators can list meals, offer catering, run cooking courses, and sell digital products. Customers can discover, order, and review food from local creators.</p>
<h2>2. Accounts</h2>
<p>You must be 18 or older to create an account. You are responsible for keeping your login credentials secure. One person, one account — shared or bot accounts are prohibited.</p>
<h2>3. Creator Obligations</h2>
<p>Creators are responsible for accurate menu descriptions, allergen information, food safety, and timely fulfilment of orders. FOODSbyme reserves the right to suspend accounts that receive repeated complaints or violate food-safety regulations.</p>
<h2>4. Payments & Fees</h2>
<p>FOODSbyme charges a platform commission on each completed transaction. Commission rates are displayed in your earnings dashboard. Payouts are processed weekly to verified creator accounts.</p>
<h2>5. Social Verification</h2>
<p>Creators may optionally connect social accounts (TikTok, YouTube, Instagram) to display verified follower counts on their profile. This connection uses official OAuth flows; FOODSbyme does not store your social media passwords.</p>
<h2>6. Prohibited Conduct</h2>
<p>You may not use FOODSbyme to distribute illegal content, engage in fraud, harass other users, or violate any applicable law. Violations result in immediate account suspension.</p>
<h2>7. Intellectual Property</h2>
<p>Content you upload (photos, videos, recipes) remains yours. By uploading, you grant FOODSbyme a licence to display that content on the platform and in marketing materials.</p>
<h2>8. Limitation of Liability</h2>
<p>FOODSbyme is a marketplace and is not liable for the quality or safety of food prepared by independent creators. Disputes between creators and customers are handled through our in-app dispute resolution process.</p>
<h2>9. Changes to These Terms</h2>
<p>We may update these terms. Continued use of the platform after changes constitutes acceptance.</p>
<h2>10. Contact</h2>
<p>Questions? Email us at <a href="mailto:support@foodsbyme.com">support@foodsbyme.com</a>.</p>
</body></html>`);
});

app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy – FOODSbyme</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#222}h1{color:#e85d04}h2{margin-top:2em}</style></head><body>
<h1>FOODSbyme Privacy Policy</h1>
<p><strong>Effective date:</strong> June 1, 2026</p>
<p>Your privacy matters to us. This policy explains what data we collect, why we collect it, and how you can control it.</p>
<h2>1. Data We Collect</h2>
<ul>
  <li><strong>Account data:</strong> name, email address, profile photo.</li>
  <li><strong>Creator data:</strong> menu items, pricing, location (general area), bank/payout details.</li>
  <li><strong>Order data:</strong> items ordered, delivery address, payment confirmation.</li>
  <li><strong>Social data:</strong> if you connect a social account, we store your public username and follower count only — no passwords, private messages, or post content.</li>
  <li><strong>Usage data:</strong> screen views, feature interactions, crash logs — used only to improve the app.</li>
</ul>
<h2>2. How We Use Your Data</h2>
<p>We use your data to operate the platform, process payments, display your creator profile, send order notifications, and improve our service. We do not sell your personal data to third parties.</p>
<h2>3. Social Account Connections</h2>
<p>When you connect TikTok, YouTube, or Instagram, we use each platform's official OAuth flow. We request only the minimum scopes needed to display your public creator stats. You can disconnect any social account at any time from your profile settings.</p>
<h2>4. Data Sharing</h2>
<p>We share data only with: payment processors (to complete transactions), cloud infrastructure providers (to host the app), and regulators (when legally required).</p>
<h2>5. Data Retention</h2>
<p>We retain your data for as long as your account is active. After account deletion, data is removed within 30 days except where retention is required by law.</p>
<h2>6. Your Rights</h2>
<p>You may request a copy of your data, correction of inaccurate data, or deletion of your account at any time by emailing <a href="mailto:privacy@foodsbyme.com">privacy@foodsbyme.com</a>.</p>
<h2>7. Cookies</h2>
<p>The FOODSbyme mobile app does not use browser cookies. Our web-facing pages use only essential session cookies.</p>
<h2>8. Children</h2>
<p>FOODSbyme is not intended for users under 18. We do not knowingly collect data from minors.</p>
<h2>9. Changes</h2>
<p>We may update this policy. We will notify you via the app if changes are material.</p>
<h2>10. Contact</h2>
<p>Privacy questions: <a href="mailto:privacy@foodsbyme.com">privacy@foodsbyme.com</a>.</p>
</body></html>`);
});

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ── GET /invoice/:id?token=JWT — branded invoice HTML page ───────────────────
// Token is the caller's standard JWT. No browser-side auth headers needed so
// expo-web-browser (and any mobile/desktop browser) can render it directly.
app.get('/invoice/:id', async (req, res) => {
  const { sql }   = require('./supabase/db');
  const jwt       = require('jsonwebtoken');
  const { token } = req.query;

  // Validate JWT
  let caller;
  try {
    caller = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).send('<h2>Session expired — please open this invoice from the FOODSbyme app.</h2>');
  }

  try {
    const rows = await sql`
      SELECT
        i.*,
        u.full_name  AS customer_name,
        u.phone      AS customer_phone,
        u.email      AS customer_email,
        cp.display_name  AS cook_name,
        cp.avatar_url    AS cook_avatar,
        cp.brand_logo    AS cook_logo,
        cp.brand_colors  AS cook_colors,
        cp.phone         AS cook_phone,
        cp.website_url   AS cook_website
      FROM invoices i
      JOIN users u         ON u.id  = i.customer_id
      JOIN cook_profiles cp ON cp.id = i.cook_id
      WHERE i.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).send('<h2>Invoice not found.</h2>');
    const inv = rows[0];

    // Auth: only parties may view
    const cookRow = caller.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${caller.id} LIMIT 1`
      : [];
    const isParty = inv.customer_id === caller.id || inv.cook_id === cookRow[0]?.id;
    if (!isParty && caller.role !== 'admin') {
      return res.status(403).send('<h2>Access denied.</h2>');
    }

    const colors    = inv.cook_colors ?? { primary: '#B36A2E', secondary: '#1A1208', accent: '#FAF6F0' };
    const primary   = colors.primary   ?? '#B36A2E';
    const secondary = colors.secondary ?? '#1A1208';
    const accent    = colors.accent    ?? '#FAF6F0';
    const naira     = v => v != null ? `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(v)}` : '—';
    const lineItems = Array.isArray(inv.line_items) ? inv.line_items : [];
    const statusColor = { draft: '#9B8B7A', sent: '#2A5FBF', paid: '#2E8B3F', partial: '#B36A2E', overdue: '#C0392B' }[inv.status] ?? '#9B8B7A';
    const fmtDate   = d => d ? new Date(d).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice ${inv.invoice_number} — ${inv.cook_name}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8F5F0;color:#1A1208;min-height:100vh}
    .page{max-width:680px;margin:0 auto;background:#fff;box-shadow:0 2px 24px rgba(0,0,0,.08)}
    .header{background:${secondary};color:#fff;padding:32px 40px 28px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
    .brand{display:flex;align-items:center;gap:14px}
    .brand img{width:52px;height:52px;border-radius:12px;object-fit:cover;border:2px solid rgba(255,255,255,.2)}
    .brand-ph{width:52px;height:52px;border-radius:12px;background:${primary};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.25rem;color:#fff;flex-shrink:0}
    .brand-name{font-size:1.1rem;font-weight:700;line-height:1.3}
    .brand-sub{font-size:.8rem;opacity:.7;margin-top:2px}
    .invoice-ref{text-align:right}
    .invoice-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin-bottom:4px}
    .invoice-number{font-size:1.4rem;font-weight:700;letter-spacing:-.01em}
    .status-badge{display:inline-block;margin-top:8px;padding:4px 12px;border-radius:40px;font-size:.75rem;font-weight:700;background:${statusColor};color:#fff;text-transform:uppercase;letter-spacing:.06em}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #F0EBE4}
    .meta-block{padding:24px 40px}
    .meta-block+.meta-block{border-left:1px solid #F0EBE4}
    .meta-title{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#9B8B7A;margin-bottom:8px;font-weight:600}
    .meta-value{font-size:.9rem;color:#1A1208;line-height:1.5}
    .meta-value strong{display:block;font-size:.95rem}
    .dates{display:flex;gap:32px;padding:16px 40px;background:${accent};border-bottom:1px solid #F0EBE4}
    .date-item{display:flex;flex-direction:column;gap:2px}
    .date-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#9B8B7A;font-weight:600}
    .date-value{font-size:.85rem;color:#1A1208;font-weight:500}
    .items{padding:0 40px 24px}
    .items-header{display:grid;grid-template-columns:1fr 80px 100px 100px;gap:8px;padding:14px 0;border-bottom:2px solid #F0EBE4;margin-top:24px}
    .items-header span{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#9B8B7A;font-weight:600}
    .items-header span:not(:first-child){text-align:right}
    .item-row{display:grid;grid-template-columns:1fr 80px 100px 100px;gap:8px;padding:12px 0;border-bottom:1px solid #F8F5F0;align-items:start}
    .item-name{font-size:.9rem;color:#1A1208;font-weight:500}
    .item-desc{font-size:.8rem;color:#9B8B7A;margin-top:2px}
    .item-num{font-size:.9rem;color:#4A3F30;text-align:right}
    .totals{margin:0 40px 32px;border-top:2px solid ${primary};padding-top:16px}
    .total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:.9rem;color:#4A3F30}
    .total-row.grand{font-size:1.1rem;font-weight:700;color:${secondary};border-top:1px solid #F0EBE4;margin-top:8px;padding-top:12px}
    .notes{margin:0 40px 32px;padding:16px;background:${accent};border-radius:10px;border-left:3px solid ${primary}}
    .notes-title{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#9B8B7A;font-weight:600;margin-bottom:6px}
    .notes-body{font-size:.85rem;color:#4A3F30;line-height:1.6}
    .footer{background:${secondary};color:rgba(255,255,255,.7);text-align:center;padding:18px 40px;font-size:.75rem;line-height:1.6}
    .footer strong{color:#fff}
    .print-btn{position:fixed;bottom:24px;right:24px;background:${primary};color:#fff;border:none;border-radius:12px;padding:12px 20px;font-size:.9rem;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;gap:8px}
    @media print{.print-btn{display:none}body{background:#fff}.page{box-shadow:none}}
    @media(max-width:520px){
      .header,.meta-block,.items,.totals,.notes,.dates{padding-left:20px;padding-right:20px}
      .meta{grid-template-columns:1fr}.meta-block+.meta-block{border-left:none;border-top:1px solid #F0EBE4}
      .items-header,.item-row{grid-template-columns:1fr 60px 80px 80px}
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="brand">
      ${inv.cook_logo
        ? `<img src="${inv.cook_logo}" alt="${inv.cook_name}">`
        : `<div class="brand-ph">${(inv.cook_name ?? 'C')[0].toUpperCase()}</div>`}
      <div>
        <div class="brand-name">${inv.cook_name}</div>
        ${inv.cook_phone ? `<div class="brand-sub">${inv.cook_phone}</div>` : ''}
        ${inv.cook_website ? `<div class="brand-sub">${inv.cook_website}</div>` : ''}
      </div>
    </div>
    <div class="invoice-ref">
      <div class="invoice-label">Invoice</div>
      <div class="invoice-number">${inv.invoice_number}</div>
      <div class="status-badge">${inv.status ?? 'draft'}</div>
    </div>
  </div>

  <!-- Parties -->
  <div class="meta">
    <div class="meta-block">
      <div class="meta-title">Billed to</div>
      <div class="meta-value">
        <strong>${inv.customer_name ?? '—'}</strong>
        ${inv.customer_phone ? inv.customer_phone + '<br>' : ''}
        ${inv.customer_email ? inv.customer_email : ''}
      </div>
    </div>
    <div class="meta-block">
      <div class="meta-title">From</div>
      <div class="meta-value">
        <strong>${inv.cook_name}</strong>
        ${inv.cook_phone ?? ''}
      </div>
    </div>
  </div>

  <!-- Dates -->
  <div class="dates">
    <div class="date-item">
      <span class="date-label">Issue date</span>
      <span class="date-value">${fmtDate(inv.created_at)}</span>
    </div>
    ${inv.due_date ? `
    <div class="date-item">
      <span class="date-label">Due date</span>
      <span class="date-value">${fmtDate(inv.due_date)}</span>
    </div>` : ''}
    ${inv.paid_at ? `
    <div class="date-item">
      <span class="date-label">Paid on</span>
      <span class="date-value">${fmtDate(inv.paid_at)}</span>
    </div>` : ''}
  </div>

  <!-- Line items -->
  <div class="items">
    <div class="items-header">
      <span>Description</span><span>Qty</span><span>Unit Price</span><span>Amount</span>
    </div>
    ${lineItems.map(item => `
    <div class="item-row">
      <div>
        <div class="item-name">${item.name ?? item.description ?? '—'}</div>
        ${item.note ? `<div class="item-desc">${item.note}</div>` : ''}
      </div>
      <div class="item-num">${item.quantity ?? 1}</div>
      <div class="item-num">${naira(item.unit_price ?? item.price)}</div>
      <div class="item-num">${naira((item.unit_price ?? item.price ?? 0) * (item.quantity ?? 1))}</div>
    </div>`).join('')}
  </div>

  <!-- Totals -->
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${naira(inv.subtotal)}</span></div>
    ${inv.discount_amount > 0 ? `<div class="total-row"><span>Discount</span><span>−${naira(inv.discount_amount)}</span></div>` : ''}
    ${inv.tax_amount > 0 ? `<div class="total-row"><span>Tax</span><span>${naira(inv.tax_amount)}</span></div>` : ''}
    <div class="total-row grand"><span>Total</span><span>${naira(inv.total)}</span></div>
    ${inv.paid_amount > 0 ? `<div class="total-row" style="color:#2E8B3F"><span>Paid</span><span>${naira(inv.paid_amount)}</span></div>` : ''}
    ${inv.total - (inv.paid_amount ?? 0) > 0 ? `<div class="total-row" style="font-weight:600"><span>Balance due</span><span>${naira(inv.total - (inv.paid_amount ?? 0))}</span></div>` : ''}
  </div>

  ${inv.notes ? `
  <div class="notes">
    <div class="notes-title">Notes</div>
    <div class="notes-body">${inv.notes}</div>
  </div>` : ''}

  <div class="footer">
    Invoice generated by <strong>FOODSbyme</strong> · Real food from real creators<br>
    ${inv.cook_website ? `<strong>${inv.cook_website}</strong>` : ''}
  </div>
</div>
<button class="print-btn" onclick="window.print()">
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
  Print / Save PDF
</button>
</body>
</html>`);
  } catch (err) {
    console.error('invoice html:', err);
    res.status(500).send('<h2>Failed to generate invoice.</h2>');
  }
});

// ── GET /certificate/:token — course completion certificate page ───────────────
app.get('/certificate/:token', async (req, res) => {
  const { sql } = require('./supabase/db');
  try {
    const raw = Buffer.from(req.params.token, 'base64url').toString('utf8');
    const [courseId, userId] = raw.split(':');

    const rows = await sql`
      SELECT
        ce.certificate_issued_at,
        c.title AS course_title,
        c.cover_image,
        u.full_name,
        cp.display_name AS cook_name,
        cp.brand_logo,
        cp.brand_colors
      FROM course_enrollments ce
      JOIN courses c ON c.id = ce.course_id
      JOIN users u ON u.id = ce.user_id
      JOIN cook_profiles cp ON cp.id = c.cook_id
      WHERE ce.course_id = ${courseId}
        AND ce.user_id = ${userId}
        AND ce.certificate_issued = true
    `;
    if (!rows.length) return res.status(404).send('<h2>Certificate not found.</h2>');
    const r = rows[0];
    const colors  = r.brand_colors ?? {};
    const primary = colors.primary ?? '#B36A2E';
    const secondary = colors.secondary ?? '#1A1208';
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Certificate — ${r.course_title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Georgia,serif;background:#F8F5F0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .cert{background:#fff;max-width:720px;width:100%;border:6px double ${primary};padding:48px 56px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.1)}
    .logo{width:64px;height:64px;border-radius:14px;object-fit:cover;margin:0 auto 16px}
    .logo-ph{width:64px;height:64px;border-radius:14px;background:${primary};color:#fff;font-size:1.5rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
    .by{font-size:.8rem;text-transform:uppercase;letter-spacing:.12em;color:#9B8B7A;margin-bottom:4px}
    .issuer{font-size:1.1rem;font-weight:700;color:${secondary};margin-bottom:32px}
    .title{font-size:.75rem;text-transform:uppercase;letter-spacing:.14em;color:#9B8B7A;margin-bottom:8px}
    .certifies{font-size:1rem;color:#4A3F30;margin-bottom:4px}
    .recipient{font-size:2rem;font-weight:700;color:${secondary};margin-bottom:8px;font-style:italic}
    .completed{font-size:.9rem;color:#4A3F30;margin-bottom:4px}
    .course{font-size:1.3rem;font-weight:700;color:${primary};margin-bottom:32px}
    .divider{height:2px;background:linear-gradient(90deg,transparent,${primary},transparent);margin:24px 0}
    .date{font-size:.85rem;color:#9B8B7A;margin-top:24px}
    .badge{display:inline-block;margin-top:24px;padding:8px 20px;border:2px solid ${primary};border-radius:40px;font-size:.75rem;color:${primary};font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .print-btn{display:block;margin:24px auto 0;padding:10px 24px;background:${primary};color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer}
    @media print{.print-btn{display:none}body{background:#fff}}
  </style>
</head>
<body>
<div class="cert">
  ${r.brand_logo ? `<img class="logo" src="${r.brand_logo}" alt="${r.cook_name}">` : `<div class="logo-ph">${(r.cook_name ?? 'F')[0]}</div>`}
  <div class="by">Presented by</div>
  <div class="issuer">${r.cook_name} · FOODSbyme</div>
  <div class="title">Certificate of Completion</div>
  <div class="certifies">This certifies that</div>
  <div class="recipient">${r.full_name}</div>
  <div class="completed">has successfully completed</div>
  <div class="course">${r.course_title}</div>
  <div class="divider"></div>
  <div class="date">Issued ${fmtDate(r.certificate_issued_at)}</div>
  <div class="badge">Verified by FOODSbyme</div>
</div>
<button class="print-btn" onclick="window.print()">Print / Save PDF</button>
</body>
</html>`);
  } catch (err) {
    res.status(500).send('<h2>Failed to load certificate.</h2>');
  }
});

// ── Start server + scheduler ───────────────────────────────
const scheduler = require('./services/scheduler');

app.listen(PORT, () => {
  console.log(`FOODSbyme API running on port ${PORT}`);
  scheduler.start();
});

module.exports = app;
