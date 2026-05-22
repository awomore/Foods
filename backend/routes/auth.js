const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sql } = require('../supabase/db');

async function sendSmsOtp(phone, otp) {
  console.log(`[OTP] ${phone} → ${otp}`);

  const apiKey = process.env.TERMII_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch('https://v3.api.termii.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to: phone,
        from: process.env.TERMII_SENDER_ID || 'N-Alert',
        sms: `Your FOODSbyme code is ${otp}. Valid for 10 minutes.`,
        type: 'plain',
        channel: process.env.TERMII_SENDER_ID ? 'generic' : 'dnd',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('Termii delivery failed:', data.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Termii error:', err.message);
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

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      INSERT INTO otp_codes (phone, code, expires_at)
      VALUES (${phone}, ${otp}, ${expiresAt.toISOString()})
      ON CONFLICT (phone) DO UPDATE
      SET code = ${otp}, expires_at = ${expiresAt.toISOString()}, attempts = 0
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
    const { phone, otp } = req.body;
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
      const newUsers = await sql`
        INSERT INTO users (phone) VALUES (${phone}) RETURNING *
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
        cook_id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /api/auth/me
 * Body: { full_name?, email? }
 * NOTE: role is not user-settable; it is set by the cook onboarding flow.
 */
router.patch('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { full_name, email } = req.body;
    const users = await sql`
      UPDATE users
      SET
        full_name  = COALESCE(${full_name ?? null}, full_name),
        email      = COALESCE(${email     ?? null}, email),
        updated_at = NOW()
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
