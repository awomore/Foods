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

// In-memory state store for OAuth round-trips (state → userId, expires 10 min)
// Fine for single-server Railway deploy; swap for Redis if you scale horizontally.
const oauthStates = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of oauthStates) {
    if (v.expiresAt < now) oauthStates.delete(k);
  }
}, 5 * 60 * 1000);

// Badge tier based on total verified subscriber / follower count across platforms
function badgeTier(totalFollowers) {
  if (totalFollowers >= 1_000_000) return 'elite';
  if (totalFollowers >= 100_000)   return 'established';
  if (totalFollowers >= 10_000)    return 'rising';
  if (totalFollowers >= 1_000)     return 'creator';
  return null;
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

// ── GET /api/social-verify/oauth/youtube?token=<jwt> ─────────────────────────
// Mobile opens this URL in a browser. We validate the JWT, create a state
// token, then redirect to Google's consent screen.
router.get('/oauth/youtube', async (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).send('<h2>YouTube OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to env.</h2>');
  }

  // Accept token from query param (no auth header available in browser redirect)
  const { token } = req.query;
  if (!token) return res.status(400).send('<h2>Missing token.</h2>');

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).send('<h2>Session expired — please try again from the app.</h2>');
  }

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
    const subscriberCount = parseInt(channel.statistics?.subscriberCount ?? '0', 10);
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

    const existingData = cook.social_oauth_data ?? {};
    const updatedData  = {
      ...existingData,
      youtube: {
        channel_id:       channelId,
        handle,
        subscriber_count: subscriberCount,
        video_count:      videoCount,
        view_count:       viewCount,
        verified_at:      new Date().toISOString(),
      },
    };

    // Sum followers across all verified platforms for badge tier
    const totalFollowers = Object.values(updatedData).reduce(
      (sum, d) => sum + (d.subscriber_count ?? d.follower_count ?? 0), 0
    );
    const tier = badgeTier(totalFollowers);

    // 4. Persist
    const existingPlatforms = Array.isArray(cook.social_verified_platforms)
      ? cook.social_verified_platforms
      : [];
    const platforms = [...new Set([...existingPlatforms, 'youtube'])];

    await sql`
      UPDATE cook_profiles SET
        social_oauth_data         = ${JSON.stringify(updatedData)}::jsonb,
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

// ── GET /api/social-verify/status — cook sees all verified platforms ───────────
router.get('/status', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT social_oauth_data, social_verified_platforms, social_badge_tier,
             social_verified, social_verified_platform, social_verified_handle
      FROM cook_profiles WHERE user_id = ${req.user.id}
    `;
    if (!rows.length) return res.json({ platforms: [], badge_tier: null });
    const c = rows[0];
    res.json({
      platforms:          c.social_verified_platforms ?? [],
      oauth_data:         c.social_oauth_data ?? {},
      badge_tier:         c.social_badge_tier,
      legacy_verified:    c.social_verified,
      legacy_platform:    c.social_verified_platform,
      legacy_handle:      c.social_verified_handle,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

module.exports = router;
