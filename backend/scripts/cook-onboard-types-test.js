// Integration test for creator_types on POST /api/cooks/onboard (routes/cooks.js).
// Drives the REAL router in-process against the real database and asserts what
// landed in cook_profiles.
//
// Exists because onboarding silently dropped creator_types: the app sent the
// cook's choice, the route never read it, and every new vendor got the column
// default — a tester who signed up as a pastry chef was registered as a home cook.
//
// Contract under test:
//   - a new profile stores the types the cook picked, in order
//   - re-running onboarding with new types replaces them; omitting them keeps them
//   - omitting them on a brand-new profile falls back to home_cook
//   - unknown or empty types are rejected and write nothing
//
// Usage: cd backend; node scripts/cook-onboard-types-test.js
require('dotenv').config();
require('./lib/assert-not-production').assertNotProduction('cook-onboard-types-test');

const express = require('express');
const jwt     = require('jsonwebtoken');
const { sql } = require('../supabase/db');

const COOK_PHONE = '+2349900000805';
const USERNAME   = 'e2eonboardtypes';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

const app = express();
app.use(express.json());
app.use('/api/cooks', require('../routes/cooks'));

let BASE, token, userId;

async function onboard(extra) {
  const res = await fetch(`${BASE}/api/cooks/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ display_name: 'E2E Onboard Types', username: USERNAME, currency_code: 'NGN', ...extra }),
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function types() {
  const [p] = await sql`SELECT creator_types FROM cook_profiles WHERE user_id = ${userId}`;
  return p ? p.creator_types : undefined;
}

const dropProfile = () => sql`DELETE FROM cook_profiles WHERE user_id = ${userId}`;

async function setup() {
  const existing = await sql`SELECT id FROM users WHERE phone = ${COOK_PHONE}`;
  userId = existing.length
    ? existing[0].id
    : (await sql`
        INSERT INTO users (full_name, phone, role, is_active)
        VALUES ('E2E Onboard Types', ${COOK_PHONE}, 'customer', true) RETURNING id`)[0].id;
  await dropProfile();
  token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  BASE = `http://127.0.0.1:${server.address().port}`;

  try {
    await setup();

    // ── 1. A new pastry chef is stored as a pastry chef ─────────────────────
    let r = await onboard({ creator_types: ['pastry_chef'] });
    let t = await types();
    check('new profile: onboard succeeds', r.status === 200, `${r.status} ${r.json?.error ?? ''}`);
    check('new profile: creator_types = [pastry_chef]',
      Array.isArray(t) && t.join(',') === 'pastry_chef', JSON.stringify(t));

    // ── 2. Re-onboarding replaces the types, keeping their order ────────────
    r = await onboard({ creator_types: ['baker', 'pastry_chef'] });
    t = await types();
    check('existing profile: types replaced in order',
      r.status === 200 && t?.join(',') === 'baker,pastry_chef', JSON.stringify(t));

    // ── 3. Omitting them on re-onboarding leaves them alone ─────────────────
    r = await onboard({});
    t = await types();
    check('existing profile: omitted types untouched',
      r.status === 200 && t?.join(',') === 'baker,pastry_chef', JSON.stringify(t));

    // ── 4. Invalid input is rejected and writes nothing ─────────────────────
    r = await onboard({ creator_types: ['not_a_real_type'] });
    t = await types();
    check('unknown type → 400', r.status === 400, `${r.status} ${r.json?.error}`);
    check('…and the stored types are unchanged', t?.join(',') === 'baker,pastry_chef', JSON.stringify(t));

    r = await onboard({ creator_types: [] });
    check('empty types → 400', r.status === 400, `${r.status} ${r.json?.error}`);

    r = await onboard({ creator_types: 'pastry_chef' });
    check('non-array types → 400', r.status === 400, `${r.status} ${r.json?.error}`);

    // ── 5. A brand-new profile without types falls back to home_cook ────────
    await dropProfile();
    r = await onboard({});
    t = await types();
    check('new profile, no types: defaults to home_cook',
      r.status === 200 && t?.join(',') === 'home_cook', JSON.stringify(t));

  } finally {
    await dropProfile().catch(() => {});
    await sql`DELETE FROM users WHERE id = ${userId}`.catch(() => {});
    await sql.end();
    server.close();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──── COOK ONBOARD TYPES TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 60)} ${String(r.detail).slice(0, 90)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e); process.exit(1); });
