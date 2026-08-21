const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const { sql } = require('../supabase/db');
const { authenticate } = require('../middleware/auth');

// ── Google / YouTube OAuth config ────────────────────────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BACKEND_BASE         = process.env.APP_BASE_URL ?? 'https://foodsbyme-production.up.railway.app';
const YOUTUBE_REDIRECT_URI = `${BACKEND_BASE}/api/social-verify/oauth/youtube/callback`;
const APP_SCHEME           = 'foodsbyme';

// ── TikTok Login Kit config ──────────────────────────────────────────────────
const TIKTOK_CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_REDIRECT_URI  = `${BACKEND_BASE}/api/social-verify/oauth/tiktok/callback`;

// ── Twitter / X OAuth 2.0 (PKCE) ────────────────────────────────────────────
const TWITTER_CLIENT_ID     = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const TWITTER_REDIRECT_URI  = `${BACKEND_BASE}/api/social-verify/oauth/twitter/callback`;

// ── Instagram Business Login ─────────────────────────────────────────────────
const INSTAGRAM_APP_ID      = process.env.INSTAGRAM_APP_ID;
const INSTAGRAM_APP_SECRET  = process.env.INSTAGRAM_APP_SECRET;
const INSTAGRAM_REDIRECT_URI = `${BACKEND_BASE}/api/social-verify/oauth/instagram/callback`;

// PKCE helpers for Twitter
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// In-memory state store for OAuth round-trips (state → userId, expires 10 min)
// Fine for single-server Railway deploy; swap for Redis if you scale horizontally.
const oauthStates = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of oauthStates) {
    if (v.expiresAt < now) oauthStates.delete(k);
  }
}, 5 * 60 * 1000);

// Badge tier from a single audience size.
function badgeTier(followers) {
  if (followers >= 1_000_000) return 'elite';
  if (followers >= 100_000)   return 'established';
  if (followers >= 10_000)    return 'rising';
  if (followers >= 1_000)     return 'creator';
  return null;
}

// Tie-break order only — used when two accounts report the same audience size.
// Food content travels furthest on Instagram and TikTok, so a tie there outranks
// a tie on X. Platforms absent from this list sort last.
const PLATFORM_PRIORITY = ['instagram', 'tiktok', 'youtube', 'twitter'];

function outranks(a, b) {
  if (a.count !== b.count) return a.count > b.count;
  const rank = p => {
    const i = PLATFORM_PRIORITY.indexOf(p);
    return i === -1 ? PLATFORM_PRIORITY.length : i;
  };
  if (rank(a.platform) !== rank(b.platform)) return rank(a.platform) < rank(b.platform);
  // Incumbent wins: the account verified first stays primary rather than the
  // display flipping every time an equally-sized account is reconnected.
  if (a.verifiedAt && b.verifiedAt) return a.verifiedAt < b.verifiedAt;
  return false;
}

// Derives a creator's social standing from their verified accounts.
//
// The badge reflects the LARGEST single verified audience, not the sum of all of
// them. Summing double-counts the same people — a creator's Instagram, TikTok and
// X followings are largely the same fans followed three times — which let three
// mid-sized accounts outrank one genuinely larger audience.
//
// A withheld count (follower_count_known === false) is not zero: it decides
// nothing. It never contributes to the tier and never wins primary. A creator
// whose every account withholds its count still verifies (social_verified stays
// true) but earns no tier — identity confirmed, audience unmeasured.
//
// primary_platform is always derived, never creator-chosen: it's the account that
// carries the most weight, which is not the same as the one a creator likes most.
// When nothing is measurable it falls back to PLATFORM_PRIORITY purely so the UI
// has a platform to show; callers must consult that account's
// follower_count_known before displaying any number.
function computeSocialStanding(oauthData) {
  let measured = null;
  let fallback = null;

  for (const [platform, d] of Object.entries(oauthData ?? {})) {
    if (!d || typeof d !== 'object') continue;
    const count = d.subscriber_count ?? d.follower_count ?? 0;
    const known = d.subscriber_count_known ?? d.follower_count_known ?? (count > 0);
    const entry = { platform, count, verifiedAt: d.verified_at ?? null };

    if (known) {
      if (!measured || outranks(entry, measured)) measured = entry;
    } else if (!fallback || outranks({ ...entry, count: 0 }, { ...fallback, count: 0 })) {
      fallback = entry;
    }
  }

  return {
    tier:             measured ? badgeTier(measured.count) : null,
    primary_platform: (measured ?? fallback)?.platform ?? null,
  };
}

// A cook's chosen username only proves platform ownership if it was the handle
// that justified it at onboarding (cooks.js requires username to match ONE claimed
// handle). The FIRST time a platform is verified, the real OAuth handle must match
// that claim — otherwise the onboarding claim was never actually theirs to make.
//
// On every later reconnect (previouslyVerifiedHandle is set), skip the check —
// fresh OAuth is itself proof of ownership, and creators who lose access to an
// account (hacked, deleted, rebranded) must be able to relink a new real one
// without the onboarding-era claim locking them out permanently.
function claimUnverified(username, claimedHandle, realHandle, previouslyVerifiedHandle) {
  if (previouslyVerifiedHandle) return false;
  if (!username || !claimedHandle) return false;
  const norm = h => h.replace(/^@/, '').trim().toLowerCase();
  return norm(username) === norm(claimedHandle) && norm(claimedHandle) !== norm(realHandle);
}

// Not every platform's OAuth scope returns a real @handle. Instagram
// (instagram_business_basic) and X (users.read) both return the authenticated
// account's username, so their stored handle is proof of ownership and can be
// written back to the cook's *_handle column and checked against the onboarding
// claim. TikTok now does the same: user.info.profile returns the real username
// (unlike display_name, a mutable label), and user.info.stats returns the follower
// count, so a TikTok account finally carries measurable standing and not just bare
// identity. Connections made before those scopes were approved stored
// handle_verified: false explicitly, so they keep reporting themselves honestly
// until the creator reconnects.
const HANDLE_VERIFIABLE = { instagram: true, twitter: true, youtube: true, tiktok: true };

// social_oauth_data must always be read through this. Writes now use sql.json(),
// which stores a real jsonb object, but `${JSON.stringify(x)}::jsonb` (what this
// file used before) makes postgres.js store a jsonb *string scalar* instead — so
// the column can still contain a JSON string on any row written by an older
// deploy. Reading such a row as an object silently yields undefined for every
// key, which is how the reconnect path lost track of previously-verified handles.
function readOAuthData(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }
  return typeof raw === 'object' ? raw : {};
}

// Public profile URLs per platform
function profileUrl(platform, handle) {
  switch (platform) {
    case 'instagram': return `https://www.instagram.com/${handle}/`;
    case 'tiktok':    return `https://www.tiktok.com/@${handle}`;
    case 'twitter':   return `https://x.com/${handle}`;
    default: return null;
  }
}

// Attempt to fetch the public profile page and search for the code.
// Returns true if found, false if not found, null if fetch failed.
async function checkBioForCode(platform, handle, code) {
  const url = profileUrl(platform, handle);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FOODSbyme-Verify/1.0)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.includes(code);
  } catch {
    return null;
  }
}

/**
 * POST /api/social-verify/start
 * Generates a verification code for a cook's social handle.
 * Stores the code against the cook profile so it persists across sessions.
 */
router.post('/start', authenticate, async (req, res) => {
  try {
    const { platform, handle } = req.body;
    if (!platform || !handle) {
      return res.status(400).json({ error: 'platform and handle are required' });
    }
    if (!['instagram', 'tiktok', 'twitter'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be instagram, tiktok, or twitter' });
    }

    const clean = handle.replace(/^@/, '').trim().toLowerCase();

    // Generate a short memorable code
    const code = 'FOOD-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    // Upsert code against cook profile
    await sql`
      UPDATE cook_profiles
      SET social_verification_code = ${code},
          social_verified_platform = ${platform},
          social_verified_handle   = ${clean}
      WHERE user_id = ${req.user.id}
    `;

    const url = profileUrl(platform, clean);

    res.json({
      code,
      platform,
      handle: clean,
      profile_url: url,
      instructions: `Open your ${platform.charAt(0).toUpperCase() + platform.slice(1)} profile (@${clean}), add "${code}" anywhere in your bio, then tap Verify.`,
    });
  } catch (err) {
    console.error('social-verify/start:', err);
    res.status(500).json({ error: 'Could not start verification' });
  }
});

/**
 * POST /api/social-verify/check
 * Scrapes the public social profile and confirms the code is present.
 */
router.post('/check', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT social_verification_code, social_verified_platform, social_verified_handle
      FROM cook_profiles WHERE user_id = ${req.user.id}
    `;
    const profile = rows[0];
    if (!profile?.social_verification_code) {
      return res.status(400).json({ error: 'No verification started. Call /start first.' });
    }

    const { social_verification_code: code, social_verified_platform: platform, social_verified_handle: handle } = profile;

    const found = await checkBioForCode(platform, handle, code);

    if (found === null) {
      // Fetch failed — can't confirm either way
      return res.status(502).json({
        error: `Could not reach your ${platform} profile automatically. Make sure your account is public, or contact support.`,
        manual_review: true,
      });
    }

    if (!found) {
      return res.status(422).json({
        error: `Code "${code}" not found in your ${platform} bio. Paste it exactly and try again.`,
      });
    }

    // Verified — mark the cook profile
    await sql`
      UPDATE cook_profiles
      SET social_verified = true,
          social_verification_code = NULL
      WHERE user_id = ${req.user.id}
    `;

    res.json({ verified: true, platform, handle });
  } catch (err) {
    console.error('social-verify/check:', err);
    res.status(500).json({ error: 'Verification check failed' });
  }
});

// ── POST /api/social-verify/oauth/init ────────────────────────────────────────
// Authenticated endpoint that issues a short-lived (60s, single-use) init token.
// The mobile app opens the OAuth URL with this token instead of the real JWT,
// so the JWT is never exposed in the browser URL bar or server access logs.
router.post('/oauth/init', authenticate, async (req, res) => {
  const initToken = crypto.randomBytes(24).toString('hex');
  oauthStates.set(`init:${initToken}`, { userId: req.user.id, expiresAt: Date.now() + 60_000, initOnly: true });
  res.json({ init_token: initToken });
});

// ── GET /api/social-verify/oauth/youtube?init_token=<short-lived> ─────────────
// Mobile opens this URL in a browser. We exchange the init token for the userId,
// create a long-lived state token, then redirect to Google's consent screen.
router.get('/oauth/youtube', async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).send('<h2>YouTube OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to env.</h2>');
  }

  const { init_token } = req.query;
  if (!init_token) return res.status(400).send('<h2>Missing init_token. Please retry from the app.</h2>');

  const initData = oauthStates.get(`init:${init_token}`);
  if (!initData || !initData.initOnly || initData.expiresAt < Date.now()) {
    return res.status(401).send('<h2>Link expired or already used — please try again from the app.</h2>');
  }
  oauthStates.delete(`init:${init_token}`); // single-use
  const { userId } = initData;

  const state = crypto.randomBytes(20).toString('hex');
  oauthStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  YOUTUBE_REDIRECT_URI,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/youtube.readonly',
    access_type:   'online',
    state,
    prompt:        'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/social-verify/oauth/youtube/callback ─────────────────────────────
// Google redirects here after the user grants permission.
router.get('/oauth/youtube/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${APP_SCHEME}://social-verify/error?platform=youtube&reason=${encodeURIComponent(error)}`);
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    return res.status(400).send('<h2>OAuth state expired or invalid. Please try again from the app.</h2>');
  }
  oauthStates.delete(state);

  const { userId } = stateData;

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  YOUTUBE_REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('YouTube token exchange failed:', tokenData);
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=youtube&reason=token_exchange_failed`);
    }

    // 2. Fetch the YouTube channel stats for the authed user
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=youtube&reason=no_channel`);
    }

    const channelId      = channel.id;
    const handle         = channel.snippet?.customUrl ?? channel.snippet?.title ?? '';
    const subsHidden      = channel.statistics?.hiddenSubscriberCount === true
                            || channel.statistics?.subscriberCount == null;
    const subscriberCount = parseInt(channel.statistics?.subscriberCount ?? '0', 10);
    if (subsHidden) {
      console.warn(`YouTube subscriber count hidden for channel ${channelId} — recording 0 as unknown, not as a real count.`);
    }
    const videoCount      = parseInt(channel.statistics?.videoCount ?? '0', 10);
    const viewCount       = parseInt(channel.statistics?.viewCount ?? '0', 10);

    // 3. Get the cook's current oauth_data + compute new badge tier
    const rows = await sql`
      SELECT id, social_oauth_data, social_verified_platforms
      FROM cook_profiles WHERE user_id = ${userId}
    `;
    if (!rows.length) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=youtube&reason=no_profile`);
    }
    const cook = rows[0];

    const existingData = readOAuthData(cook.social_oauth_data);
    const updatedData  = {
      ...existingData,
      youtube: {
        channel_id:             channelId,
        handle,
        subscriber_count:       subscriberCount,
        // Channels can hide their subscriber count; the API then omits the field
        // entirely. Don't let that read as "0 subscribers" in badge_tier terms.
        subscriber_count_known: !subsHidden,
        handle_verified:        HANDLE_VERIFIABLE.youtube,
        video_count:            videoCount,
        view_count:             viewCount,
        verified_at:            new Date().toISOString(),
      },
    };

    const { tier } = computeSocialStanding(updatedData);

    // 4. Persist
    const existingPlatforms = Array.isArray(cook.social_verified_platforms)
      ? cook.social_verified_platforms
      : [];
    const platforms = [...new Set([...existingPlatforms, 'youtube'])];

    await sql`
      UPDATE cook_profiles SET
        social_oauth_data         = ${sql.json(updatedData)},
        social_verified_platforms = ${platforms}::text[],
        social_badge_tier         = ${tier},
        social_verified           = true
      WHERE user_id = ${userId}
    `;

    // 5. Deep-link back into app with success state
    const params = new URLSearchParams({
      platform:         'youtube',
      handle:           handle.startsWith('@') ? handle : `@${handle}`,
      subscriber_count: String(subscriberCount),
      badge_tier:       tier ?? '',
    });
    res.redirect(`${APP_SCHEME}://social-verify/success?${params}`);

  } catch (err) {
    console.error('YouTube OAuth callback error:', err);
    res.redirect(`${APP_SCHEME}://social-verify/error?platform=youtube&reason=server_error`);
  }
});

// ── GET /api/social-verify/oauth/tiktok ──────────────────────────────────────
// Mobile opens this URL in a browser. We exchange the short-lived init token
// for the userId, then redirect to TikTok's consent screen.
router.get('/oauth/tiktok', async (req, res) => {
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return res.status(503).send('<h2>TikTok OAuth not configured. Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET to env.</h2>');
  }

  const { init_token } = req.query;
  if (!init_token) return res.status(400).send('<h2>Missing init_token. Please retry from the app.</h2>');

  const initData = oauthStates.get(`init:${init_token}`);
  if (!initData || !initData.initOnly || initData.expiresAt < Date.now()) {
    return res.status(401).send('<h2>Link expired or already used — please try again from the app.</h2>');
  }
  oauthStates.delete(`init:${init_token}`); // single-use
  const { userId } = initData;

  const state = crypto.randomBytes(20).toString('hex');
  oauthStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_key:    TIKTOK_CLIENT_KEY,
    scope:         'user.info.basic,user.info.profile,user.info.stats',
    response_type: 'code',
    redirect_uri:  TIKTOK_REDIRECT_URI,
    state,
  });

  res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params}`);
});

// ── GET /api/social-verify/oauth/tiktok/callback ──────────────────────────────
// TikTok redirects here after the user grants permission.
router.get('/oauth/tiktok/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(`${APP_SCHEME}://social-verify/error?platform=tiktok&reason=${encodeURIComponent(error_description ?? error)}`);
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    return res.status(400).send('<h2>OAuth state expired or invalid. Please try again from the app.</h2>');
  }
  oauthStates.delete(state);

  const { userId } = stateData;

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key:    TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  TIKTOK_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('TikTok token exchange failed:', tokenData);
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=tiktok&reason=token_exchange_failed`);
    }

    // 2. Fetch user info. user.info.profile adds `username` (the real @handle,
    // unlike the mutable display_name) and user.info.stats adds follower_count.
    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const userData = await userRes.json();
    const user = userData.data?.user;

    if (!user?.open_id) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=tiktok&reason=no_user`);
    }

    // 3. Get cook profile and merge oauth data
    const rows = await sql`
      SELECT id, username, tiktok_handle, social_oauth_data, social_verified_platforms
      FROM cook_profiles WHERE user_id = ${userId}
    `;
    if (!rows.length) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=tiktok&reason=no_profile`);
    }
    const cook = rows[0];

    const existingData = readOAuthData(cook.social_oauth_data);

    // user.info.profile and user.info.stats need TikTok's approval, and this code
    // ships before it. Until the scopes are granted TikTok returns neither field,
    // so everything below degrades to exactly the old identity-only behaviour
    // rather than crashing on an absent username or, worse, storing a handle it
    // never verified. It starts verifying on its own the moment TikTok approves —
    // no redeploy, no flag.
    const handle         = typeof user.username === 'string' && user.username ? user.username : null;
    const handleVerified = HANDLE_VERIFIABLE.tiktok && handle !== null;

    // follower_count is withheld for some account states rather than returned as
    // 0 — the same withheld-vs-genuinely-zero distinction as Instagram and X.
    const rawFollowers   = user.follower_count;
    const followersKnown = typeof rawFollowers === 'number';
    const followerCount  = followersKnown ? rawFollowers : 0;

    // With a verifiable handle TikTok joins the anti-impersonation rule. Existing
    // connections stored open_id but never a `handle`, so passing open_id as the
    // prior proof stops every one of them reading as a first-time claim — which
    // would lock out any creator whose self-typed tiktok_handle never matched
    // their real username. No lockout, ever, once verified once.
    if (handleVerified && claimUnverified(cook.username, cook.tiktok_handle, handle,
                        existingData.tiktok?.handle ?? existingData.tiktok?.open_id)) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=tiktok&reason=handle_mismatch`);
    }

    const updatedData  = {
      ...existingData,
      tiktok: {
        open_id:              user.open_id,
        // Store a handle only when it was actually verified. Presenting an
        // unverified handle as verified is the one thing this must never do.
        ...(handleVerified ? { handle } : {}),
        display_name:         user.display_name ?? '',
        avatar_url:           user.avatar_url   ?? '',
        follower_count:       followerCount,
        follower_count_known: followersKnown,
        handle_verified:      handleVerified,
        verified_at:          new Date().toISOString(),
      },
    };

    const { tier } = computeSocialStanding(updatedData);

    const existingPlatforms = Array.isArray(cook.social_verified_platforms)
      ? cook.social_verified_platforms : [];
    const platforms = [...new Set([...existingPlatforms, 'tiktok'])];

    await sql`
      UPDATE cook_profiles SET
        tiktok_handle             = ${handleVerified ? handle : cook.tiktok_handle},
        social_oauth_data         = ${sql.json(updatedData)},
        social_verified_platforms = ${platforms}::text[],
        social_badge_tier         = ${tier},
        social_verified           = true
      WHERE user_id = ${userId}
    `;

    // 4. Deep-link back into app with success state. Send a `handle` param only
    // when it is verified; otherwise fall back to the display_name shape, because
    // labelling a display name as a handle tells the creator we confirmed
    // something we did not.
    const successParams = new URLSearchParams(handleVerified
      ? {
          platform:       'tiktok',
          handle:         `@${handle}`,
          follower_count: String(followerCount),
          badge_tier:     tier ?? '',
        }
      : {
          platform:        'tiktok',
          display_name:    user.display_name ?? '',
          handle_verified: 'false',
          badge_tier:      tier ?? '',
        });
    res.redirect(`${APP_SCHEME}://social-verify/success?${successParams}`);

  } catch (err) {
    console.error('TikTok OAuth callback error:', err);
    res.redirect(`${APP_SCHEME}://social-verify/error?platform=tiktok&reason=server_error`);
  }
});

// ── GET /api/social-verify/oauth/twitter ─────────────────────────────────────
router.get('/oauth/twitter', async (req, res) => {
  if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
    return res.status(503).send('<h2>Twitter OAuth not configured. Add TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET to env.</h2>');
  }

  const { init_token } = req.query;
  if (!init_token) return res.status(400).send('<h2>Missing init_token. Please retry from the app.</h2>');

  const initData = oauthStates.get(`init:${init_token}`);
  if (!initData || !initData.initOnly || initData.expiresAt < Date.now()) {
    return res.status(401).send('<h2>Link expired or already used — please try again from the app.</h2>');
  }
  oauthStates.delete(`init:${init_token}`); // single-use
  const { userId } = initData;

  const state        = crypto.randomBytes(20).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  oauthStates.set(state, { userId, codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             TWITTER_CLIENT_ID,
    redirect_uri:          TWITTER_REDIRECT_URI,
    scope:                 'tweet.read users.read',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
});

// ── GET /api/social-verify/oauth/twitter/callback ─────────────────────────────
router.get('/oauth/twitter/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${APP_SCHEME}://social-verify/error?platform=twitter&reason=${encodeURIComponent(error)}`);
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    return res.status(400).send('<h2>OAuth state expired or invalid. Please try again from the app.</h2>');
  }
  oauthStates.delete(state);

  const { userId, codeVerifier } = stateData;

  try {
    // 1. Exchange code for access token (PKCE — no client_secret needed in body, use Basic auth)
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type:    'authorization_code',
        redirect_uri:  TWITTER_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Twitter token exchange failed:', tokenData);
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=twitter&reason=token_exchange_failed`);
    }

    // 2. Fetch user profile (username + follower count)
    const userRes = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=username,name,public_metrics',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const userData = await userRes.json();
    const twitterUser = userData.data;

    if (!twitterUser?.username) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=twitter&reason=no_user`);
    }

    const handle = twitterUser.username;

    // public_metrics is withheld on some X API access tiers. A missing field and
    // a genuine 0 followers are indistinguishable downstream once both become 0,
    // which silently understates badge_tier — record which one happened.
    const rawFollowers   = twitterUser.public_metrics?.followers_count;
    const followersKnown = typeof rawFollowers === 'number';
    const followerCount  = followersKnown ? rawFollowers : 0;
    if (!followersKnown) {
      console.warn(
        `Twitter public_metrics.followers_count withheld for @${handle} ` +
        `(API tier or field-level restriction) — recording 0 as unknown, not as a real count.`
      );
    }

    // 3. Merge into cook profile
    const rows = await sql`
      SELECT id, username, twitter_handle, social_oauth_data, social_verified_platforms
      FROM cook_profiles WHERE user_id = ${userId}
    `;
    if (!rows.length) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=twitter&reason=no_profile`);
    }
    const cook = rows[0];
    const existingData = readOAuthData(cook.social_oauth_data);

    if (claimUnverified(cook.username, cook.twitter_handle, handle, existingData.twitter?.handle)) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=twitter&reason=handle_mismatch`);
    }

    const updatedData  = {
      ...existingData,
      twitter: {
        handle,
        display_name:          twitterUser.name ?? '',
        follower_count:        followerCount,
        follower_count_known:  followersKnown,
        handle_verified:       HANDLE_VERIFIABLE.twitter,
        verified_at:           new Date().toISOString(),
      },
    };

    const { tier } = computeSocialStanding(updatedData);

    const existingPlatforms = Array.isArray(cook.social_verified_platforms)
      ? cook.social_verified_platforms : [];
    const platforms = [...new Set([...existingPlatforms, 'twitter'])];

    await sql`
      UPDATE cook_profiles SET
        twitter_handle            = ${handle},
        social_oauth_data         = ${sql.json(updatedData)},
        social_verified_platforms = ${platforms}::text[],
        social_badge_tier         = ${tier},
        social_verified           = true
      WHERE user_id = ${userId}
    `;

    const successParams = new URLSearchParams({
      platform:       'twitter',
      handle:         `@${handle}`,
      follower_count: String(followerCount),
      badge_tier:     tier ?? '',
    });
    res.redirect(`${APP_SCHEME}://social-verify/success?${successParams}`);

  } catch (err) {
    console.error('Twitter OAuth callback error:', err);
    res.redirect(`${APP_SCHEME}://social-verify/error?platform=twitter&reason=server_error`);
  }
});

// ── GET /api/social-verify/oauth/instagram ────────────────────────────────────
// Uses Instagram Business Login (replaces deprecated Basic Display API, Dec 2024).
// Only works for Professional (Business or Creator) Instagram accounts.
router.get('/oauth/instagram', async (req, res) => {
  if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
    return res.status(503).send('<h2>Instagram OAuth not configured. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET to env.</h2>');
  }

  const { init_token } = req.query;
  if (!init_token) return res.status(400).send('<h2>Missing init_token. Please retry from the app.</h2>');

  const initData = oauthStates.get(`init:${init_token}`);
  if (!initData || !initData.initOnly || initData.expiresAt < Date.now()) {
    return res.status(401).send('<h2>Link expired or already used — please try again from the app.</h2>');
  }
  oauthStates.delete(`init:${init_token}`); // single-use
  const { userId } = initData;

  const state = crypto.randomBytes(20).toString('hex');
  oauthStates.set(state, { userId, expiresAt: Date.now() + 10 * 60 * 1000 });

  const params = new URLSearchParams({
    client_id:     INSTAGRAM_APP_ID,
    redirect_uri:  INSTAGRAM_REDIRECT_URI,
    response_type: 'code',
    scope:         'instagram_business_basic',
    state,
  });

  res.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
});

// ── GET /api/social-verify/oauth/instagram/callback ───────────────────────────
router.get('/oauth/instagram/callback', async (req, res) => {
  const { code, state, error, error_reason } = req.query;

  if (error) {
    return res.redirect(`${APP_SCHEME}://social-verify/error?platform=instagram&reason=${encodeURIComponent(error_reason ?? error)}`);
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    return res.status(400).send('<h2>OAuth state expired or invalid. Please try again from the app.</h2>');
  }
  oauthStates.delete(state);

  const { userId } = stateData;

  try {
    // 1. Exchange code for short-lived token
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        grant_type:    'authorization_code',
        redirect_uri:  INSTAGRAM_REDIRECT_URI,
        code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Instagram token exchange failed:', tokenData);
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=instagram&reason=token_exchange_failed`);
    }

    // 2. Fetch profile (username, follower count, account type)
    const userRes = await fetch(
      `https://graph.instagram.com/v22.0/me?fields=id,username,name,account_type,followers_count&access_token=${tokenData.access_token}`
    );
    const igUser = await userRes.json();

    if (!igUser?.username) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=instagram&reason=no_user`);
    }

    const handle = igUser.username;

    // Same withheld-vs-genuinely-zero distinction as X: followers_count is absent
    // for some account types rather than returned as 0.
    const rawFollowers   = igUser.followers_count;
    const followersKnown = typeof rawFollowers === 'number';
    const followerCount  = followersKnown ? rawFollowers : 0;
    if (!followersKnown) {
      console.warn(
        `Instagram followers_count absent for @${handle} ` +
        `(account_type=${igUser.account_type ?? 'UNKNOWN'}) — recording 0 as unknown, not as a real count.`
      );
    }

    // 3. Merge into cook profile
    const rows = await sql`
      SELECT id, username, instagram_handle, social_oauth_data, social_verified_platforms
      FROM cook_profiles WHERE user_id = ${userId}
    `;
    if (!rows.length) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=instagram&reason=no_profile`);
    }
    const cook = rows[0];
    const existingData = readOAuthData(cook.social_oauth_data);

    if (claimUnverified(cook.username, cook.instagram_handle, handle, existingData.instagram?.handle)) {
      return res.redirect(`${APP_SCHEME}://social-verify/error?platform=instagram&reason=handle_mismatch`);
    }

    const updatedData  = {
      ...existingData,
      instagram: {
        // Stored solely so a Meta data-deletion callback can be resolved to this
        // row — the signed request identifies the person by platform user id and
        // nothing else. See deleteInstagramConnection() below.
        user_id:              igUser.id ? String(igUser.id) : null,
        handle,
        display_name:         igUser.name ?? '',
        follower_count:       followerCount,
        follower_count_known: followersKnown,
        handle_verified:      HANDLE_VERIFIABLE.instagram,
        account_type:         igUser.account_type ?? 'UNKNOWN',
        verified_at:          new Date().toISOString(),
      },
    };

    const { tier } = computeSocialStanding(updatedData);

    const existingPlatforms = Array.isArray(cook.social_verified_platforms)
      ? cook.social_verified_platforms : [];
    const platforms = [...new Set([...existingPlatforms, 'instagram'])];

    await sql`
      UPDATE cook_profiles SET
        instagram_handle          = ${handle},
        social_oauth_data         = ${sql.json(updatedData)},
        social_verified_platforms = ${platforms}::text[],
        social_badge_tier         = ${tier},
        social_verified           = true
      WHERE user_id = ${userId}
    `;

    const successParams = new URLSearchParams({
      platform:       'instagram',
      handle:         `@${handle}`,
      follower_count: String(followerCount),
      badge_tier:     tier ?? '',
    });
    res.redirect(`${APP_SCHEME}://social-verify/success?${successParams}`);

  } catch (err) {
    console.error('Instagram OAuth callback error:', err);
    res.redirect(`${APP_SCHEME}://social-verify/error?platform=instagram&reason=server_error`);
  }
});

// ── GET /api/social-verify/status — cook sees all verified platforms ───────────
router.get('/status', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT social_oauth_data, social_verified_platforms, social_badge_tier,
             social_verified, social_verified_platform, social_verified_handle
      FROM cook_profiles WHERE user_id = ${req.user.id}
    `;
    if (!rows.length) {
      return res.json({ platforms: [], accounts: [], badge_tier: null, primary_platform: null });
    }
    const c = rows[0];
    const oauthData = readOAuthData(c.social_oauth_data);

    // Normalised, UI-ready view of each connected account. handle_verified and
    // *_count_known are derived rather than read straight off the row so records
    // written before those keys existed still report correctly — a TikTok entry
    // predating user.info.profile stored handle_verified: false explicitly, so it
    // keeps reporting false even though the platform is now verifiable.
    const accounts = Object.entries(oauthData).map(([platform, d]) => {
      const followers = d.subscriber_count ?? d.follower_count ?? 0;
      const known = d.subscriber_count_known ?? d.follower_count_known ?? (followers > 0);
      return {
        platform,
        handle:           d.handle ?? null,
        display_name:     d.display_name ?? null,
        handle_verified:  d.handle_verified ?? HANDLE_VERIFIABLE[platform] ?? false,
        follower_count:   followers,
        follower_count_known: known,
        verified_at:      d.verified_at ?? null,
      };
    });

    // Recomputed here rather than trusted from the row: social_badge_tier was
    // written by whatever rule was live at the time (older deploys summed every
    // platform and counted withheld metrics as zero), so the stored value can
    // disagree with the current rule until the creator next reconnects something.
    const standing = computeSocialStanding(oauthData);

    res.json({
      platforms:          c.social_verified_platforms ?? [],
      oauth_data:         oauthData,
      accounts,
      badge_tier:         standing.tier,
      primary_platform:   standing.primary_platform,
      stored_badge_tier:  c.social_badge_tier,
      legacy_verified:    c.social_verified,
      legacy_platform:    c.social_verified_platform,
      legacy_handle:      c.social_verified_handle,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

// ── Instagram data deletion (Meta callback) ──────────────────────────────────
// Meta POSTs a signed deletion request to /data-deletion when someone removes
// FOODSbyme from their Instagram settings. That request identifies the person by
// their platform-scoped user id and nothing else, which is why the Instagram
// callback now stores igUser.id — without it a deletion request cannot be
// resolved to a row at all, and the endpoint can only pretend to honour it.
//
// Scope is the Instagram CONNECTION, not the account. Meta's callback means "stop
// holding my Instagram data", not "delete my FOODSbyme profile" — account deletion
// is a separate flow (deletion_requested_at, set in routes/auth.js).
//
// instagram_handle is cleared too. It may have started as a self-typed onboarding
// claim, but the OAuth callback overwrites it with the platform-supplied handle,
// so what's in the column now is Instagram data and goes with the rest.
async function deleteInstagramConnection(igUserId) {
  if (!igUserId) return { deleted: false, reason: 'no_user_id' };

  const rows = await sql`
    SELECT user_id, social_oauth_data, social_verified_platforms
    FROM cook_profiles
    WHERE social_oauth_data -> 'instagram' ->> 'user_id' = ${String(igUserId)}
  `;
  if (!rows.length) return { deleted: false, reason: 'not_found' };

  for (const cook of rows) {
    const data = readOAuthData(cook.social_oauth_data);
    delete data.instagram;

    const platforms = (Array.isArray(cook.social_verified_platforms)
      ? cook.social_verified_platforms : []).filter(p => p !== 'instagram');
    // Recomputed, not just cleared: the badge may have rested on the Instagram
    // audience, and another platform must now carry it (or nothing should).
    const { tier } = computeSocialStanding(data);

    await sql`
      UPDATE cook_profiles SET
        instagram_handle          = NULL,
        social_oauth_data         = ${sql.json(data)},
        social_verified_platforms = ${platforms}::text[],
        social_badge_tier         = ${tier},
        social_verified           = ${platforms.length > 0}
      WHERE user_id = ${cook.user_id}
    `;
  }

  return { deleted: true, count: rows.length };
}

module.exports = router;
module.exports.deleteInstagramConnection = deleteInstagramConnection;
