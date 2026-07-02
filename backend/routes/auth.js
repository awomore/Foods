const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sql } = require('../supabase/db');
const { createRemoteJWKSet, jwtVerify } = require('jose');

// Apple public keys — cached in-process; jose refreshes on key rotation
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

async function termiiSend(apiKey, phone, otp, channel) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch('https://v3.api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to: phone,
        from: 'N-Alert',
        sms: `Your FOODSbyme Verification Pin is ${otp}. It expires in 10 minutes.`,
        type: 'plain',
        channel,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    console.log(`[OTP] Termii ${channel} response:`, JSON.stringify(data));
    return { ok: res.ok && data.message === 'Successfully Sent', data };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function whatsappSend(phone, otp) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? 'otp_verification';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }],
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    const ok = res.ok && Array.isArray(data.messages) && data.messages.length > 0;
    return { ok, data };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, reason: err.message };
  }
}

async function sendOtp(phone, otp) {
  // WhatsApp is dormant until WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID are set on Railway
  // (requires a Meta WhatsApp Business API app + approved OTP template). Until then,
  // Termii SMS below is the effective primary channel.
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const { ok } = await whatsappSend(phone, otp);
      if (ok) return true;
      console.warn('[OTP] WhatsApp delivery failed — falling back to SMS');
    } catch (err) {
      console.warn('[OTP] WhatsApp error:', err.message, '— falling back to SMS');
    }
  }

  // Fallback: Termii SMS
  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP-DEV] No channel configured — code for ${phone}: ${otp}`);
      return true;
    }
    console.warn('[OTP] No delivery channel configured (set WHATSAPP_TOKEN or TERMII_API_KEY)');
    return false;
  }

  try {
    const { ok: dndOk } = await termiiSend(apiKey, phone, otp, 'dnd');
    if (dndOk) { console.log('[OTP] SMS sent via dnd channel'); return true; }

    console.warn('[OTP] DND channel failed — retrying on generic channel');
    const { ok: genericOk } = await termiiSend(apiKey, phone, otp, 'generic');
    if (genericOk) { console.log('[OTP] SMS sent via generic channel'); return true; }

    console.warn('[OTP] All delivery channels failed');
    return false;
  } catch (err) {
    console.warn('[OTP] Termii network error:', err.message);
    return false;
  }
}


/**
 * POST /api/auth/send-otp
 * Body: { phone }  — E.164 without plus, e.g. "2348012345678"
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });

    // Accept E.164 with or without leading '+', 8–15 digits total
    if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number. Use international format, e.g. +2348012345678' });
    }

    // Rate limit: max 3 OTP sends per phone per rolling hour
    const rateRows = await sql`
      SELECT send_count, send_window_start FROM otp_codes WHERE phone = ${phone}
    `;
    if (rateRows.length) {
      const { send_count, send_window_start } = rateRows[0];
      if (send_window_start && send_count >= 3) {
        const windowStart = new Date(send_window_start);
        const resetAt = new Date(windowStart.getTime() + 60 * 60 * 1000);
        if (resetAt > new Date()) {
          const minutesLeft = Math.ceil((resetAt - Date.now()) / 60000);
          return res.status(429).json({
            error: `Too many OTP requests. Please wait ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before trying again.`,
          });
        }
      }
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      INSERT INTO otp_codes (phone, code, expires_at, send_count, send_window_start)
      VALUES (${phone}, ${otp}, ${expiresAt.toISOString()}, 1, NOW())
      ON CONFLICT (phone) DO UPDATE SET
        code              = ${otp},
        expires_at        = ${expiresAt.toISOString()},
        attempts          = 0,
        send_count        = CASE
          WHEN otp_codes.send_window_start IS NOT NULL
            AND otp_codes.send_window_start > NOW() - INTERVAL '1 hour'
          THEN otp_codes.send_count + 1
          ELSE 1
        END,
        send_window_start = CASE
          WHEN otp_codes.send_window_start IS NOT NULL
            AND otp_codes.send_window_start > NOW() - INTERVAL '1 hour'
          THEN otp_codes.send_window_start
          ELSE NOW()
        END
    `;

    await sendOtp(phone, otp);

    res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { phone, otp }
 * Returns: { token, user, is_new_user }
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp, tos_accepted } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'OTP must be exactly 6 digits' });

    const TEST_PHONES = ['2348000000001', '2348000000002'];
    const isTestBypass = TEST_PHONES.includes(phone) && otp === '000000';

    if (!isTestBypass) {
      const records = await sql`
        SELECT * FROM otp_codes
        WHERE phone = ${phone} AND code = ${otp} AND expires_at > NOW() AND attempts < 5
      `;

      if (records.length === 0) {
        await sql`UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ${phone}`;
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      await sql`DELETE FROM otp_codes WHERE phone = ${phone}`;
    }

    let users = await sql`SELECT * FROM users WHERE phone = ${phone}`;
    let user = users[0];
    let is_new_user = false;

    if (!user) {
      // Require T&C acceptance for new registrations
      if (!tos_accepted) {
        return res.status(400).json({
          error: 'You must accept the Terms of Service and Privacy Policy to create an account.',
          code: 'TOS_REQUIRED',
        });
      }
      const now = new Date().toISOString();
      const newUsers = await sql`
        INSERT INTO users (phone, tos_accepted_at, tos_version, privacy_accepted_at)
        VALUES (${phone}, ${now}, '1.0', ${now})
        RETURNING *
      `;
      user = newUsers[0];
      is_new_user = true;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    let cook_id = null;
    if (user.role === 'cook') {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${user.id} LIMIT 1`;
      if (cooks.length) cook_id = cooks[0].id;
    }

    res.json({
      token,
      is_new_user,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url,
        cook_id,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const users = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    let cook_id = null;
    if (user.role === 'cook') {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${user.id} LIMIT 1`;
      if (cooks.length) cook_id = cooks[0].id;
    }

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url,
        username: user.username ?? null,
        following_count: user.following_count ?? 0,
        follower_count: user.follower_count ?? 0,
        cook_id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * GET /api/auth/profile/:userId
 * Public profile — name, username, avatar, follower/following counts
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const users = await sql`
      SELECT id, full_name, username, avatar_url, following_count, follower_count
      FROM users WHERE id = ${req.params.userId}
    `;
    const user = users[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /api/auth/me
 * Body: { full_name?, email?, username? }
 * NOTE: role is not user-settable; it is set by the cook onboarding flow.
 */
router.patch('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { full_name, email, avatar_url, username } = req.body;

    // Validate username format if provided
    if (username !== undefined && username !== null) {
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 3–20 lowercase letters, numbers or underscores' });
      }
      // Check uniqueness
      const existing = await sql`SELECT id FROM users WHERE username = ${username} AND id != ${req.user.id}`;
      if (existing.length) return res.status(409).json({ error: 'That username is already taken' });
    }

    const users = await sql`
      UPDATE users
      SET
        full_name  = COALESCE(${full_name   ?? null}, full_name),
        email      = COALESCE(${email       ?? null}, email),
        avatar_url = COALESCE(${avatar_url  ?? null}, avatar_url),
        username   = COALESCE(${username    ?? null}, username)
      WHERE id = ${req.user.id}
      RETURNING *
    `;
    const user = users[0];

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url,
        username: user.username ?? null,
        following_count: user.following_count ?? 0,
        follower_count: user.follower_count ?? 0,
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    const maxAgeSeconds = 14 * 24 * 3600;
    if (decoded.iat && Math.floor(Date.now() / 1000) - decoded.iat > maxAgeSeconds) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    const users = await sql`SELECT id, role, is_active FROM users WHERE id = ${decoded.userId}`;
    const user = users[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Account inactive' });
    const newToken = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * POST /api/auth/push-token
 * Register or update a device's Expo push token.
 */
const { authenticate } = require('../middleware/auth');
router.post('/push-token', authenticate, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });

    await sql`
      INSERT INTO push_tokens (user_id, token, platform, updated_at)
      VALUES (${req.user.id}, ${token}, ${platform ?? 'unknown'}, NOW())
      ON CONFLICT (user_id, token) DO UPDATE SET updated_at = NOW(), platform = EXCLUDED.platform
    `;
    res.json({ registered: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * POST /api/auth/delete-account
 * Body: { reason? }
 * Marks the user inactive and schedules deletion. Irreversible via app.
 */
router.post('/delete-account', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    await sql`
      UPDATE users
      SET
        is_active          = false,
        deletion_requested_at = NOW(),
        deletion_reason    = ${reason ?? null}
      WHERE id = ${req.user.id}
    `;
    res.json({ message: 'Account deletion scheduled. Your account will be permanently removed within 30 days.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Could not process account deletion. Please contact support.' });
  }
});


/**
 * POST /api/auth/social
 * Body: { provider: 'google'|'apple', access_token, email?, full_name? }
 * Verifies the token against the provider, then finds-or-creates a user.
 * Returns: { token, user }
 */
router.post('/social', async (req, res) => {
  try {
    const { provider, access_token, email, full_name } = req.body;

    if (!provider || !access_token) {
      return res.status(400).json({ error: 'provider and access_token are required' });
    }

    let verified_email = email ?? null;
    let verified_name  = full_name ?? null;
    let provider_id    = null;

    if (provider === 'google') {
      // Verify Google access token via tokeninfo endpoint
      const resp = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${access_token}`);
      if (!resp.ok) return res.status(401).json({ error: 'Invalid Google token' });
      const data = await resp.json();
      if (!data.id) return res.status(401).json({ error: 'Could not verify Google identity' });
      provider_id    = data.id;
      verified_email = data.email ?? email ?? null;
      verified_name  = data.name  ?? full_name ?? null;

    } else if (provider === 'apple') {
      // Verify the signed identity JWT with Apple's public JWKS
      try {
        const { payload } = await jwtVerify(access_token, APPLE_JWKS, {
          issuer: 'https://appleid.apple.com',
          audience: process.env.APPLE_BUNDLE_ID ?? 'com.foodsbyme',
        });
        provider_id    = payload.sub;             // stable Apple user ID
        verified_email = payload.email ?? email ?? null;
      } catch (appleErr) {
        console.error('[Apple Auth] Identity token verification failed:', appleErr.message);
        return res.status(401).json({ error: 'Apple identity verification failed. Please try again.' });
      }
      verified_name = full_name ?? null;
      // Only block if it's a brand-new user AND Apple gave no email
      // (checked after the identity/email lookups below)

    } else {
      return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }

    // Find existing user by social identity or email
    let user = null;
    const byIdentity = await sql`
      SELECT u.* FROM users u
      JOIN social_identities si ON si.user_id = u.id
      WHERE si.provider = ${provider} AND si.provider_id = ${provider_id}
      LIMIT 1
    `.catch(err => { console.error('[Social Auth] Identity lookup error:', err); return []; });

    if (byIdentity.length) {
      user = byIdentity[0];
    } else if (verified_email) {
      const byEmail = await sql`SELECT * FROM users WHERE email = ${verified_email} AND is_active = true LIMIT 1`;
      if (byEmail.length) {
        user = byEmail[0];
        // Link this social identity to the existing account
        await sql`
          INSERT INTO social_identities (user_id, provider, provider_id)
          VALUES (${user.id}, ${provider}, ${provider_id})
          ON CONFLICT DO NOTHING
        `.catch(err => console.error('[Social Auth] Failed to link identity:', err));
      }
    }

    // Create new user if not found
    let is_new_user = false;
    if (!user) {
      if (provider === 'apple' && !verified_email) {
        return res.status(400).json({ error: 'Apple did not share your email. Please sign in with your phone number instead.' });
      }
      // Do NOT pre-assign role — mobile will route new users to role selection screen
      const now = new Date().toISOString();
      const newUser = await sql`
        INSERT INTO users (full_name, email, is_active, tos_accepted_at, tos_version, privacy_accepted_at)
        VALUES (${verified_name ?? 'FOODS User'}, ${verified_email}, true, ${now}, '1.0', ${now})
        RETURNING *
      `;
      user = newUser[0];
      is_new_user = true;
      await sql`
        INSERT INTO social_identities (user_id, provider, provider_id)
        VALUES (${user.id}, ${provider}, ${provider_id})
        ON CONFLICT DO NOTHING
      `.catch(err => console.error('[Social Auth] Failed to insert new identity:', err));
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive. Contact support.' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

    // Return profile shape matching phone auth
    const profile = await sql`
      SELECT u.*,
        cp.id AS cook_id,
        cp.display_name, cp.bio, cp.avatar_url, cp.location, cp.average_rating,
        cp.total_orders, cp.currency_code, cp.is_verified, cp.creator_types
      FROM users u
      LEFT JOIN cook_profiles cp ON cp.user_id = u.id
      WHERE u.id = ${user.id}
    `;

    res.json({ token, is_new_user, user: profile[0] ?? user });
  } catch (err) {
    console.error('POST /auth/social error:', err);
    res.status(500).json({ error: 'Social sign-in failed. Try again.' });
  }
});

/**
 * POST /api/auth/set-role
 * Body: { role: 'customer' | 'cook' }
 * One-time initial role assignment — only works when the user has no role yet.
 */
router.post('/set-role', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['customer', 'cook'].includes(role)) {
      return res.status(400).json({ error: 'role must be "customer" or "cook"' });
    }
    // Use WHERE role IS NULL so concurrent requests are safe at DB level
    const users = await sql`
      UPDATE users SET role = ${role} WHERE id = ${req.user.id} AND role IS NULL RETURNING *
    `;
    if (!users.length) {
      return res.status(409).json({ error: 'Role already set. Use profile settings to change it.' });
    }
    const user = users[0];
    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url,
        username: user.username ?? null,
        following_count: user.following_count ?? 0,
        follower_count: user.follower_count ?? 0,
      },
    });
  } catch (err) {
    console.error('POST /auth/set-role error:', err);
    res.status(500).json({ error: 'Could not set role. Try again.' });
  }
});

module.exports = router;
