const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sql } = require('../supabase/db');
const { authenticate } = require('../middleware/auth');

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

module.exports = router;
