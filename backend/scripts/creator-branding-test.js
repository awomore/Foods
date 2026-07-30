// Integration test for PUT /api/creator-branding (routes/creatorBranding.js).
// Drives the REAL router in-process against the real database and asserts what
// landed in cook_profiles.
//
// Exists because that endpoint was dead on arrival: it hand-rolled a SET clause
// and called sql(queryString, values), which postgres.js rejects with
// NOT_TAGGED_CALL, so every save 500'd. Nothing covered it.
//
// Contract under test:
//   - only the fields present in the body are written; others are untouched
//   - an explicit null clears a field (undefined must NOT be treated as null)
//   - brand_colors lands as a jsonb OBJECT, not a double-encoded string scalar
//   - slug format / uniqueness / empty-body validation still reject
//
// Usage: cd backend; node scripts/creator-branding-test.js
require('dotenv').config();
require('./lib/assert-not-production').assertNotProduction('creator-branding-test');

const express = require('express');
const jwt     = require('jsonwebtoken');
const { sql } = require('../supabase/db');

const COOK_PHONE = '+2349900000804';
const USERNAME   = 'e2ebrandingcook';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

const app = express();
app.use(express.json());
app.use('/api/creator-branding', require('../routes/creatorBranding'));

let BASE, token, userId, profileId, otherProfileId;

async function put(body, opts = {}) {
  const res = await fetch(`${BASE}/api/creator-branding`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(opts.noAuth ? {} : { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function profile() {
  const [p] = await sql`
    SELECT cover_image, brand_logo, brand_colors, typography_theme, social_banner,
           creator_types, profile_slug, slug_updated_at, bio
    FROM cook_profiles WHERE id = ${profileId}`;
  return p;
}

async function setup() {
  const existing = await sql`SELECT id FROM users WHERE phone = ${COOK_PHONE}`;
  if (existing.length) {
    userId = existing[0].id;
  } else {
    const [u] = await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES ('E2E Branding Cook', ${COOK_PHONE}, 'cook', true) RETURNING id`;
    userId = u.id;
  }

  const [cp] = await sql`SELECT id FROM cook_profiles WHERE user_id = ${userId}`;
  profileId = cp
    ? cp.id
    : (await sql`
        INSERT INTO cook_profiles (user_id, display_name, username)
        VALUES (${userId}, 'E2E Branding Cook', ${USERNAME}) RETURNING id`)[0].id;

  // Any other profile, to test slug uniqueness against a real conflict.
  const [other] = await sql`
    SELECT id, profile_slug FROM cook_profiles
    WHERE id != ${profileId} AND profile_slug IS NOT NULL LIMIT 1`;
  otherProfileId = other ?? null;

  await sql`
    UPDATE cook_profiles SET
      cover_image = NULL, brand_logo = NULL, brand_colors = NULL,
      typography_theme = 'default', social_banner = NULL,
      profile_slug = NULL, slug_updated_at = NULL, bio = NULL
    WHERE id = ${profileId}`;

  token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  BASE = `http://127.0.0.1:${server.address().port}`;

  try {
    await setup();

    // ── 1. A save actually succeeds ─────────────────────────────────────────
    const colors = { primary: '#FF6B35', secondary: '#1A1009', accent: '#FAF6F0' };
    let r = await put({
      bio: 'Jollof specialist',
      brand_colors: colors,
      typography_theme: 'modern',
      creator_types: ['home_cook', 'caterer'],
    });
    check('PUT with fields → 200', r.status === 200, `${r.status} ${JSON.stringify(r.json)?.slice(0, 120)}`);

    let p = await profile();
    check('  …bio written', p.bio === 'Jollof specialist', String(p.bio));
    check('  …typography_theme written', p.typography_theme === 'modern', String(p.typography_theme));
    check('  …creator_types written as a real text[]',
      Array.isArray(p.creator_types) && p.creator_types.join(',') === 'home_cook,caterer',
      JSON.stringify(p.creator_types));

    // The bug class from 7731e55: a jsonb string scalar reads back as a string.
    check('  …brand_colors is a jsonb OBJECT, not a double-encoded string',
      typeof p.brand_colors === 'object' && p.brand_colors?.primary === '#FF6B35',
      `${typeof p.brand_colors} ${JSON.stringify(p.brand_colors)}`);
    const [{ kind }] = await sql`SELECT jsonb_typeof(brand_colors) AS kind FROM cook_profiles WHERE id = ${profileId}`;
    check('  …jsonb_typeof(brand_colors) = object', kind === 'object', String(kind));

    // ── 2. Absent fields are left alone ─────────────────────────────────────
    r = await put({ cover_image: 'https://cdn.example/cover.jpg' });
    p = await profile();
    check('PUT of one field leaves the others untouched',
      r.status === 200 && p.cover_image === 'https://cdn.example/cover.jpg'
      && p.bio === 'Jollof specialist' && p.typography_theme === 'modern',
      JSON.stringify({ cover: p.cover_image, bio: p.bio, typo: p.typography_theme }));

    // ── 3. Explicit null clears — the client sends bio: null to do this ──────
    r = await put({ bio: null });
    p = await profile();
    check('explicit null clears the field (undefined ≠ null)',
      r.status === 200 && p.bio === null && p.cover_image === 'https://cdn.example/cover.jpg',
      JSON.stringify({ bio: p.bio, cover: p.cover_image }));

    // ── 4. Slug: format, uniqueness, and slug_updated_at ────────────────────
    r = await put({ profile_slug: 'Not A Slug!' });
    check('invalid slug → 400', r.status === 400, `${r.status} ${r.json?.error}`);

    r = await put({ profile_slug: 'e2e-branding-cook' });
    p = await profile();
    check('valid slug → 200 and stamps slug_updated_at',
      r.status === 200 && p.profile_slug === 'e2e-branding-cook' && !!p.slug_updated_at,
      JSON.stringify({ slug: p.profile_slug, at: p.slug_updated_at }));

    if (otherProfileId) {
      r = await put({ profile_slug: otherProfileId.profile_slug });
      check('slug already taken by another cook → 409', r.status === 409, `${r.status} ${r.json?.error}`);
    } else {
      check('slug conflict case skipped (no other profile has a slug)', true, 'skipped');
    }

    // ── 5. Nothing to update / no auth ──────────────────────────────────────
    r = await put({});
    check('empty body → 400', r.status === 400, `${r.status} ${r.json?.error}`);

    r = await put({ bio: 'x' }, { noAuth: true });
    check('no token → 401', r.status === 401, String(r.status));

    // ── 6. The dedicated creator-types endpoint still validates ─────────────
    const bad = await fetch(`${BASE}/api/creator-branding/creator-types`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ creator_types: ['not_a_real_type'] }),
    });
    check('creator-types rejects an unknown type → 400', bad.status === 400, String(bad.status));

  } finally {
    await sql`
      UPDATE cook_profiles SET
        cover_image = NULL, brand_logo = NULL, brand_colors = NULL,
        typography_theme = 'default', profile_slug = NULL, slug_updated_at = NULL, bio = NULL
      WHERE id = ${profileId}`.catch(() => {});
    await sql.end();
    server.close();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──── CREATOR BRANDING TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 60)} ${String(r.detail).slice(0, 90)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e); process.exit(1); });
