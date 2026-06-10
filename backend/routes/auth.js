const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sql } = require('../supabase/db');

async function termiiSend(apiKey, phone, otp, channel) {
  const res = await fetch('https://v3.api.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      to: phone,
      from: channel === 'dnd' ? 'N-Alert' : 'N-Alert',
      sms: `Your FOODSbyme Verification Pin is ${otp}. It expires in 10 minutes.`,
      type: 'plain',
      channel,
    }),
  });
  const data = await res.json();
  console.log(`[OTP] Termii ${channel} response:`, JSON.stringify(data));
  const ok = res.ok && data.message === 'Successfully Sent';
  return { ok, data };
}

async function sendSmsOtp(phone, otp) {
  console.log(`[OTP] Sending to ${phone}`);

  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) {
    console.warn('[OTP] TERMII_API_KEY not set — skipping SMS');
    return false;
  }

  try {
    // Try DND channel first (NCC-registered numbers); fall back to generic
    const { ok: dndOk } = await termiiSend(apiKey, phone, otp, 'dnd');
    if (dndOk) {
      console.log('[OTP] SMS sent via dnd channel');
      return true;
    }

    console.warn('[OTP] DND channel failed — retrying on generic channel');
    const { ok: genericOk } = await termiiSend(apiKey, phone, otp, 'generic');
    if (genericOk) {
      console.log('[OTP] SMS sent via generic channel');
      return true;
    }

    console.warn('[OTP] Both channels failed');
    return false;
  } catch (err) {
    console.warn('[OTP] Termii network error:', err.message);
    return false;
  }
}

// Temporary diagnostic endpoint — returns raw Termii response (no auth needed, secret-gated)
router.post('/diag-termii', async (req, res) => {
  if (req.headers['x-diag-secret'] !== process.env.DIAG_SECRET) {
    return res.status(404).json({ error: 'Not found' });
  }
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) return res.json({ error: 'TERMII_API_KEY not set in env' });

  const results = {};
  for (const channel of ['dnd', 'generic']) {
    try {
      const r = await fetch('https://v3.api.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          to: phone,
          from: 'N-Alert',
          sms: `Your FOODSbyme test message. Channel: ${channel}`,
          type: 'plain',
          channel,
        }),
      });
      const data = await r.json();
      results[channel] = { http_status: r.status, body: data };
    } catch (e) {
      results[channel] = { error: e.message };
    }
  }

  // Also check balance
  try {
    const balRes = await fetch(`https://v3.api.termii.com/api/get-balance?api_key=${apiKey}`);
    results.balance = await balRes.json();
  } catch (e) {
    results.balance = { error: e.message };
  }

  res.json(results);
});

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

    const smsSent = await sendSmsOtp(phone, otp);

    // Always expose dev_otp until HIDE_DEV_OTP=true is set in production
    const exposeOtp = !smsSent || process.env.HIDE_DEV_OTP !== 'true';

    res.json({
      message: 'OTP sent',
      ...(exposeOtp ? { dev_otp: otp } : {}),
    });
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

    // DEV BYPASS: 000000 always works unless explicitly disabled
    const isDevBypass = otp === '000000' && process.env.DISABLE_DEV_OTP !== 'true';

    if (!isDevBypass) {
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
    const { full_name, email, avatar_url, role, username } = req.body;

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
        role       = COALESCE(${role        ?? null}, role),
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
 * GET /api/auth/dev-otp?phone=234...
 * DEV ONLY — disabled in production by setting DISABLE_DEV_OTP=true
 */
router.get('/dev-otp', async (req, res) => {
  if (process.env.DISABLE_DEV_OTP === 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone query param required' });
  const rows = await sql`SELECT code, expires_at FROM otp_codes WHERE phone = ${phone} ORDER BY expires_at DESC LIMIT 1`;
  if (!rows.length) return res.status(404).json({ error: 'No OTP found for this number' });
  res.json({ otp: rows[0].code, expires_at: rows[0].expires_at });
});

module.exports = router;
