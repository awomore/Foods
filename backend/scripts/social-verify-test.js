// Integration test for the social-verify OAuth callbacks (routes/socialVerify.js).
// Drives the REAL routes end-to-end in-process — /oauth/init → /oauth/<platform>
// (to mint a genuine state) → /oauth/<platform>/callback — with global.fetch
// stubbed so no Instagram/X/TikTok call ever leaves the machine. Asserts both the
// deep-link the app receives and what actually landed in cook_profiles.
//
// Covers the anti-impersonation contract:
//   - first-ever verification + claimed handle justified the username + real
//     handle differs            → reject, write nothing
//   - real handle matches claim → verify, write handle back
//   - reconnect after a prior verification, any real handle → allow (no lockout)
//   - claimed handle that never justified the username → not our business, allow
//   - TikTok                    → identity confirmed, handle NEVER confirmed
//   - withheld follower metrics → recorded as unknown, not as a real 0
//
// …and the social-standing rule: badge tier comes from the largest single
// *measured* audience (never the sum across platforms), primary_platform is
// derived, and an unknown count decides neither.
//
// Usage: cd backend; node scripts/social-verify-test.js
require('dotenv').config();

// The router reads these at require time and 503s without them. Values are never
// sent anywhere — the stub intercepts every outbound call.
process.env.INSTAGRAM_APP_ID     ??= 'test-ig-app';
process.env.INSTAGRAM_APP_SECRET ??= 'test-ig-secret';
process.env.TWITTER_CLIENT_ID    ??= 'test-tw-id';
process.env.TWITTER_CLIENT_SECRET??= 'test-tw-secret';
process.env.TIKTOK_CLIENT_KEY    ??= 'test-tt-key';
process.env.TIKTOK_CLIENT_SECRET ??= 'test-tt-secret';

const express = require('express');
const jwt     = require('jsonwebtoken');
const { sql } = require('../supabase/db');

const COOK_PHONE = '+2349900000803';
const USERNAME   = 'e2esocialcook';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

// ── Outbound HTTP stub ───────────────────────────────────────────────────────
// Anything aimed at the local test server passes through; every platform URL is
// answered from `scenario`, which each test case rewrites before it runs.
const realFetch = global.fetch;
let scenario = {};

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

global.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('127.0.0.1') || u.includes('localhost')) return realFetch(url, init);

  if (u.includes('api.instagram.com/oauth/access_token')) return jsonResponse({ access_token: 'stub-ig-token', user_id: '123' });
  if (u.includes('graph.instagram.com')) {
    const body = { id: '123', name: 'IG Display Name', account_type: 'BUSINESS', username: scenario.igUsername };
    if (scenario.igFollowers !== undefined) body.followers_count = scenario.igFollowers;
    return jsonResponse(body);
  }
  if (u.includes('api.twitter.com/2/oauth2/token')) return jsonResponse({ access_token: 'stub-tw-token' });
  if (u.includes('api.twitter.com/2/users/me')) {
    const data = { id: '456', name: 'X Display Name', username: scenario.twUsername };
    if (scenario.twFollowers !== undefined) data.public_metrics = { followers_count: scenario.twFollowers };
    return jsonResponse({ data });
  }
  if (u.includes('open.tiktokapis.com/v2/oauth/token')) return jsonResponse({ access_token: 'stub-tt-token' });
  if (u.includes('open.tiktokapis.com/v2/user/info')) {
    return jsonResponse({ data: { user: { open_id: 'tt-open-id', display_name: scenario.ttDisplayName, avatar_url: 'https://x/y.jpg' } } });
  }
  throw new Error(`unstubbed outbound fetch: ${u}`);
};

// ── Test server ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/social-verify', require('../routes/socialVerify'));

let BASE, token, userId, profileId;

async function call(method, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(opts.auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, location: res.headers.get('location'), json: opts.json ? await res.json() : null };
}

// Walks init → authorize to obtain a state the router itself minted, so the test
// exercises the real single-use init-token path rather than reaching into module state.
async function mintState(platform) {
  const { json } = await call('POST', '/api/social-verify/oauth/init', { auth: true, json: true });
  const r = await call('GET', `/api/social-verify/oauth/${platform}?init_token=${json.init_token}`);
  if (!r.location) throw new Error(`no redirect from /oauth/${platform} (status ${r.status})`);
  return new URL(r.location).searchParams.get('state');
}

async function driveCallback(platform) {
  const state = await mintState(platform);
  const r = await call('GET', `/api/social-verify/oauth/${platform}/callback?code=stub-code&state=${state}`);
  return r.location ?? `NO-REDIRECT(status ${r.status})`;
}

const reason = link => new URL(link).searchParams.get('reason');
const param  = (link, k) => new URL(link).searchParams.get(k);
const isSuccess = link => link.startsWith('foodsbyme://social-verify/success');

async function profile() {
  const [p] = await sql`
    SELECT username, instagram_handle, twitter_handle, tiktok_handle,
           social_oauth_data, social_verified_platforms, social_badge_tier
    FROM cook_profiles WHERE id = ${profileId}`;
  return p;
}

// Resets the cook back to "onboarded, nothing verified yet": username matches the
// self-typed handles, which is exactly the state the check is designed to police.
async function resetProfile(handles = { instagram: USERNAME, twitter: USERNAME, tiktok: USERNAME }) {
  await sql`
    UPDATE cook_profiles SET
      instagram_handle = ${handles.instagram ?? null},
      twitter_handle   = ${handles.twitter   ?? null},
      tiktok_handle    = ${handles.tiktok    ?? null},
      social_oauth_data = '{}'::jsonb,
      social_verified_platforms = '{}'::text[],
      social_badge_tier = NULL,
      social_verified = false
    WHERE id = ${profileId}`;
}

async function setup() {
  const existing = await sql`SELECT id FROM users WHERE phone = ${COOK_PHONE}`;
  if (existing.length) {
    userId = existing[0].id;
  } else {
    const [u] = await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES ('E2E Social Cook', ${COOK_PHONE}, 'cook', true) RETURNING id`;
    userId = u.id;
  }

  const [cp] = await sql`SELECT id FROM cook_profiles WHERE user_id = ${userId}`;
  if (cp) {
    profileId = cp.id;
    await sql`UPDATE cook_profiles SET username = ${USERNAME} WHERE id = ${profileId}`;
  } else {
    const [p] = await sql`
      INSERT INTO cook_profiles (user_id, display_name, username)
      VALUES (${userId}, 'E2E Social Cook', ${USERNAME}) RETURNING id`;
    profileId = p.id;
  }

  token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  BASE = `http://127.0.0.1:${server.address().port}`;

  try {
    await setup();

    // ── 1. Instagram: false claim on first verification → rejected ───────────
    await resetProfile();
    scenario = { igUsername: 'someone_else_entirely', igFollowers: 5000 };
    let link = await driveCallback('instagram');
    check('IG first verify, claim justified username, real handle differs → handle_mismatch',
      reason(link) === 'handle_mismatch', link);

    let p = await profile();
    check('  …rejected verify wrote nothing to instagram_handle', p.instagram_handle === USERNAME, String(p.instagram_handle));
    check('  …rejected verify stored no instagram oauth data',
      !p.social_oauth_data?.instagram, JSON.stringify(p.social_oauth_data));
    check('  …rejected verify did not mark instagram verified',
      !(p.social_verified_platforms ?? []).includes('instagram'), JSON.stringify(p.social_verified_platforms));

    // ── 2. Instagram: truthful claim → verified ──────────────────────────────
    await resetProfile();
    scenario = { igUsername: USERNAME, igFollowers: 12345 };
    link = await driveCallback('instagram');
    check('IG first verify, real handle matches claim → success', isSuccess(link), link);
    p = await profile();
    check('  …handle written back', p.instagram_handle === USERNAME, String(p.instagram_handle));
    check('  …handle_verified true', p.social_oauth_data?.instagram?.handle_verified === true,
      JSON.stringify(p.social_oauth_data?.instagram));
    check('  …follower count recorded as known', p.social_oauth_data?.instagram?.follower_count === 12345
      && p.social_oauth_data.instagram.follower_count_known === true, JSON.stringify(p.social_oauth_data?.instagram));
    check('  …badge tier from 12345 followers = rising', p.social_badge_tier === 'rising', String(p.social_badge_tier));

    // ── 3. Instagram: reconnect a DIFFERENT real account → no lockout ────────
    // Lost-account recovery: already verified once, so a brand-new real handle
    // must be accepted and overwrite the stored one.
    scenario = { igUsername: 'my_rebranded_account', igFollowers: 800 };
    link = await driveCallback('instagram');
    check('IG reconnect after prior verify, different real handle → success (no lockout)', isSuccess(link), link);
    p = await profile();
    check('  …stored handle overwritten with the new real one',
      p.instagram_handle === 'my_rebranded_account', String(p.instagram_handle));
    check('  …badge tier recomputed downward (800 → null)', p.social_badge_tier === null, String(p.social_badge_tier));

    // ── 4. Claim that never justified the username → not policed ─────────────
    // username is USERNAME but the claimed IG handle is something else, so the
    // handle was never the thing that unlocked the username. Mismatch is fine.
    await resetProfile({ instagram: 'unrelated_claim', twitter: USERNAME, tiktok: USERNAME });
    scenario = { igUsername: 'also_unrelated', igFollowers: 10 };
    link = await driveCallback('instagram');
    check('IG claim unrelated to username, real handle differs → allowed', isSuccess(link), link);

    // ── 5. Instagram: followers_count absent → recorded as unknown ───────────
    await resetProfile();
    scenario = { igUsername: USERNAME }; // no igFollowers → field omitted
    link = await driveCallback('instagram');
    p = await profile();
    check('IG withheld followers_count → follower_count_known false',
      isSuccess(link) && p.social_oauth_data?.instagram?.follower_count_known === false
      && p.social_oauth_data.instagram.follower_count === 0,
      JSON.stringify(p.social_oauth_data?.instagram));

    // ── 6. Twitter: false claim on first verification → rejected ─────────────
    await resetProfile();
    scenario = { twUsername: 'not_this_person', twFollowers: 200000 };
    link = await driveCallback('twitter');
    check('X first verify, claim justified username, real handle differs → handle_mismatch',
      reason(link) === 'handle_mismatch', link);
    p = await profile();
    check('  …rejected verify left twitter_handle alone', p.twitter_handle === USERNAME, String(p.twitter_handle));

    // ── 7. Twitter: truthful claim → verified ────────────────────────────────
    await resetProfile();
    scenario = { twUsername: USERNAME, twFollowers: 250000 };
    link = await driveCallback('twitter');
    check('X first verify, real handle matches claim → success', isSuccess(link), link);
    p = await profile();
    check('  …handle_verified true + tier established',
      p.social_oauth_data?.twitter?.handle_verified === true && p.social_badge_tier === 'established',
      JSON.stringify(p.social_oauth_data?.twitter));

    // ── 8. Twitter: public_metrics withheld → unknown, not a real 0 ──────────
    await resetProfile();
    scenario = { twUsername: USERNAME }; // no public_metrics at all
    link = await driveCallback('twitter');
    p = await profile();
    check('X withheld public_metrics → follower_count_known false',
      isSuccess(link) && p.social_oauth_data?.twitter?.follower_count_known === false,
      JSON.stringify(p.social_oauth_data?.twitter));

    // ── 9. TikTok: identity confirmed, handle never confirmed ────────────────
    await resetProfile();
    scenario = { ttDisplayName: 'Some Display Name' };
    link = await driveCallback('tiktok');
    check('TikTok connect → success', isSuccess(link), link);
    check('  …deep-link carries display_name, NOT a handle',
      param(link, 'display_name') === 'Some Display Name' && param(link, 'handle') === null, link);
    check('  …deep-link flags handle_verified=false', param(link, 'handle_verified') === 'false', link);
    p = await profile();
    check('  …self-typed tiktok_handle left untouched (never verified)',
      p.tiktok_handle === USERNAME, String(p.tiktok_handle));
    check('  …stored entry marks handle_verified false and stores no handle',
      p.social_oauth_data?.tiktok?.handle_verified === false && p.social_oauth_data.tiktok.handle === undefined,
      JSON.stringify(p.social_oauth_data?.tiktok));

    // ── 10. /status exposes the normalised, UI-ready view ────────────────────
    const { json: status } = await call('GET', '/api/social-verify/status', { auth: true, json: true });
    const tt = status.accounts?.find(a => a.platform === 'tiktok');
    check('/status returns accounts[] with tiktok handle_verified false',
      !!tt && tt.handle_verified === false, JSON.stringify(status.accounts));

    // ── 11. Standing is the LARGEST audience, not the sum ────────────────────
    // 5000 + 6000 would sum past the 10k 'rising' threshold. It must not: those
    // are largely the same followers counted twice. Max = 6000 → 'creator'.
    await resetProfile();
    scenario = { igUsername: USERNAME, igFollowers: 5000 };
    await driveCallback('instagram');
    scenario = { twUsername: USERNAME, twFollowers: 6000 };
    await driveCallback('twitter');
    p = await profile();
    check('two platforms 5000+6000 → tier from the larger one (creator), not the sum (rising)',
      p.social_badge_tier === 'creator', String(p.social_badge_tier));

    let st = (await call('GET', '/api/social-verify/status', { auth: true, json: true })).json;
    check('  …/status primary_platform is the bigger account (twitter)',
      st.primary_platform === 'twitter', String(st.primary_platform));
    check('  …/status badge_tier agrees with the stored one', st.badge_tier === 'creator', String(st.badge_tier));

    // ── 12. A withheld count decides nothing ─────────────────────────────────
    // IG withholds; X reports 1500. The unknown account must neither set the tier
    // (as a 0) nor win primary, even though IG outranks X on the tie-break list.
    await resetProfile();
    scenario = { igUsername: USERNAME }; // followers_count omitted
    await driveCallback('instagram');
    scenario = { twUsername: USERNAME, twFollowers: 1500 };
    await driveCallback('twitter');
    p = await profile();
    check('withheld IG count ignored → tier comes from the measured X account',
      p.social_badge_tier === 'creator', String(p.social_badge_tier));
    st = (await call('GET', '/api/social-verify/status', { auth: true, json: true })).json;
    check('  …unmeasured account does not win primary despite tie-break priority',
      st.primary_platform === 'twitter', String(st.primary_platform));

    // ── 13. Nothing measurable → verified, but no tier ───────────────────────
    // TikTok reports no follower count at all. Identity is confirmed, audience is
    // not: no tier, yet primary_platform still names a platform for the UI.
    await resetProfile();
    scenario = { ttDisplayName: 'Some Display Name' };
    await driveCallback('tiktok');
    p = await profile();
    check('TikTok-only → no badge tier (audience unmeasured)', p.social_badge_tier === null, String(p.social_badge_tier));
    st = (await call('GET', '/api/social-verify/status', { auth: true, json: true })).json;
    check('  …but primary_platform still falls back to tiktok for display',
      st.primary_platform === 'tiktok' && st.badge_tier === null,
      `${st.primary_platform} / ${st.badge_tier}`);

    // ── 14. Init token is single-use ─────────────────────────────────────────
    const { json: init } = await call('POST', '/api/social-verify/oauth/init', { auth: true, json: true });
    const first  = await call('GET', `/api/social-verify/oauth/instagram?init_token=${init.init_token}`);
    const second = await call('GET', `/api/social-verify/oauth/instagram?init_token=${init.init_token}`);
    check('init_token is single-use (second use 401s)',
      first.status === 302 && second.status === 401, `${first.status} then ${second.status}`);

    // ── 15. A stale/forged state is refused ─────────────────────────────────
    const forged = await call('GET', '/api/social-verify/oauth/instagram/callback?code=x&state=deadbeef');
    check('unknown state rejected before any token exchange', forged.status === 400, String(forged.status));

  } finally {
    await resetProfile({ instagram: null, twitter: null, tiktok: null });
    await sql.end();
    server.close();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──── SOCIAL VERIFY OAUTH TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 62)} ${String(r.detail).slice(0, 90)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e); process.exit(1); });
