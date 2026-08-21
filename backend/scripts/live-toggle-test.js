// Drives PATCH /api/cooks/:id/live in-process against the DEV database.
//
// Covers the rules that are easy to regress silently: a watch link may only point
// at an OAuth-verified handle, the copy only promises a stream when there is one,
// and going offline clears the destination rather than leaving it stale.
require('dotenv').config();
const express = require('express');
const jwt     = require('jsonwebtoken');
const { sql } = require('../supabase/db');

const PHONE      = '+2349900000804';
const FOLLOWER_A = '+2349900000805';
const FOLLOWER_B = '+2349900000806';
const followerIds = [];
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

let BASE, token, userId, profileId;

async function setup() {
  const [u0] = await sql`SELECT id FROM users WHERE phone = ${PHONE}`;
  userId = u0?.id ?? (await sql`
    INSERT INTO users (full_name, phone, role, is_active)
    VALUES ('E2E Live Cook', ${PHONE}, 'cook', true) RETURNING id`)[0].id;

  const [cp] = await sql`SELECT id FROM cook_profiles WHERE user_id = ${userId}`;
  profileId = cp?.id ?? (await sql`
    INSERT INTO cook_profiles (user_id, display_name, username)
    VALUES (${userId}, 'E2E Live Cook', 'e2elivecook') RETURNING id`)[0].id;

  token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '10m' });

  // Two followers, deliberately asymmetric:
  //   A has TWO devices  → must still get exactly ONE in-app row
  //   B has NO device    → must still get an in-app row at all
  for (const [phone, name] of [[FOLLOWER_A, 'E2E Follower A'], [FOLLOWER_B, 'E2E Follower B']]) {
    const [u] = await sql`SELECT id FROM users WHERE phone = ${phone}`;
    const fid = u?.id ?? (await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES (${name}, ${phone}, 'customer', true) RETURNING id`)[0].id;
    followerIds.push(fid);
    await sql`
      INSERT INTO follows (customer_id, cook_id, notify_live)
      VALUES (${fid}, ${profileId}, true)
      ON CONFLICT (customer_id, cook_id) DO UPDATE SET notify_live = true`;
  }
  await sql`DELETE FROM push_tokens WHERE user_id = ANY(${followerIds}::uuid[])`;
  for (const tok of ['e2e-live-token-phone', 'e2e-live-token-tablet']) {
    await sql`INSERT INTO push_tokens (user_id, token) VALUES (${followerIds[0]}, ${tok})
              ON CONFLICT DO NOTHING`;
  }
}

async function setOauth(data) {
  await sql`UPDATE cook_profiles SET social_oauth_data = ${sql.json(data)} WHERE id = ${profileId}`;
}
async function profile() {
  const [p] = await sql`
    SELECT is_live, live_platform, live_started_at FROM cook_profiles WHERE id = ${profileId}`;
  return p;
}
async function patchLive(body) {
  const res = await fetch(`${BASE}/api/cooks/${profileId}/live`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function lastNotification() {
  const [n] = await sql`
    SELECT title, body, data FROM notifications
     WHERE type = 'cook_live' AND user_id = ANY(${followerIds}::uuid[])
     ORDER BY created_at DESC LIMIT 1`;
  return n;
}
async function notificationCounts() {
  const rows = await sql`
    SELECT user_id, COUNT(*)::int AS n FROM notifications
     WHERE type = 'cook_live' AND user_id = ANY(${followerIds}::uuid[])
     GROUP BY user_id`;
  return Object.fromEntries(rows.map(r => [r.user_id, r.n]));
}
async function clearNotifications() {
  await sql`DELETE FROM notifications WHERE type = 'cook_live' AND user_id = ANY(${followerIds}::uuid[])`;
}

(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/cooks', require('../routes/cooks'));
  const server = app.listen(0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  try {
    await setup();

    // 1. Plain "kitchen open" — no platform, no promise of video
    await setOauth({});
    let r = await patchLive({ is_live: true });
    check('kitchen open without a platform → 200', r.status === 200, JSON.stringify(r.json));
    check('  …no watch_url returned', r.json?.watch_url === null, JSON.stringify(r.json));
    let p = await profile();
    check('  …is_live true, live_platform null', p.is_live === true && p.live_platform === null,
      JSON.stringify(p));
    check('  …live_started_at recorded (sweepable)', p.live_started_at !== null, String(p.live_started_at));

    // 2. Unverified handle must NOT earn a watch link
    await setOauth({ instagram: { handle: 'someone_elses_big_account', handle_verified: false } });
    r = await patchLive({ is_live: true, live_platform: 'instagram' });
    check('unverified Instagram handle → 409, not a link', r.status === 409, JSON.stringify(r.json));
    check('  …error names the platform', r.json?.code === 'handle_not_verified' && r.json?.platform === 'instagram',
      JSON.stringify(r.json));

    // 3. Verified Instagram earns one
    await setOauth({ instagram: { handle: 'chef_ada', handle_verified: true } });
    r = await patchLive({ is_live: true, live_platform: 'instagram' });
    check('verified Instagram → 200 with watch_url', r.status === 200 &&
      r.json?.watch_url === 'https://www.instagram.com/chef_ada/', JSON.stringify(r.json));
    let n = await lastNotification();
    check('  …copy names Instagram, not a phantom stream',
      /live on Instagram/.test(n?.title ?? '') && /Tap to watch on Instagram/.test(n?.body ?? ''),
      JSON.stringify(n));

    // 4. Verified TikTok uses the /live path
    await setOauth({ tiktok: { handle: 'chef_ada', handle_verified: true } });
    r = await patchLive({ is_live: true, live_platform: 'tiktok' });
    check('verified TikTok → /live URL', r.json?.watch_url === 'https://www.tiktok.com/@chef_ada/live',
      JSON.stringify(r.json));

    // 4b. Every follower notified exactly once, device count irrelevant
    await clearNotifications();
    await patchLive({ is_live: false });
    await patchLive({ is_live: true, live_platform: 'tiktok' });
    const counts = await notificationCounts();
    check('follower with 2 devices gets exactly 1 in-app row',
      counts[followerIds[0]] === 1, JSON.stringify(counts));
    check('follower with NO device still gets an in-app row',
      counts[followerIds[1]] === 1, JSON.stringify(counts));

    // 5. Bad platform rejected
    r = await patchLive({ is_live: true, live_platform: 'youtube' });
    check('unsupported platform → 400', r.status === 400, JSON.stringify(r.json));

    // 6. Going offline clears the destination
    r = await patchLive({ is_live: false });
    p = await profile();
    check('going offline clears platform and start time',
      p.is_live === false && p.live_platform === null && p.live_started_at === null, JSON.stringify(p));

    // 7. Offline + platform must not resurrect a link
    r = await patchLive({ is_live: false, live_platform: 'tiktok' });
    p = await profile();
    check('offline ignores live_platform', p.is_live === false && p.live_platform === null,
      JSON.stringify(p));

  } finally {
    await sql`DELETE FROM notifications WHERE type = 'cook_live' AND user_id = ANY(${followerIds}::uuid[])`;
    await sql`DELETE FROM push_tokens WHERE user_id = ANY(${followerIds}::uuid[])`;
    await sql`DELETE FROM follows WHERE cook_id = ${profileId} AND customer_id = ANY(${followerIds}::uuid[])`;
    await sql`UPDATE cook_profiles SET is_live = false, live_platform = NULL, live_started_at = NULL,
              social_oauth_data = '{}'::jsonb WHERE id = ${profileId}`;
    server.close();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(58)} ${String(r.detail).slice(0, 90)}`);
  }
  console.log(`\n${results.length} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });
