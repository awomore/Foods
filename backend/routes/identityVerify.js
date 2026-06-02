const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE   = 'https://api.paystack.co';

// Paystack identity verification endpoints
async function paystackVerifyNIN(nin) {
  if (!PAYSTACK_SECRET) {
    return { data: { first_name: 'MOCK', last_name: 'USER', mobile: '', verified: true } };
  }
  const res = await fetch(`${PAYSTACK_BASE}/identity/resolve_nin`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${PAYSTACK_SECRET}`,
    },
    body: JSON.stringify({ nin }),
  });
  return res.json();
}

async function paystackVerifyBVN(bvn) {
  if (!PAYSTACK_SECRET) {
    return { data: { first_name: 'MOCK', last_name: 'USER', mobile: '', verified: true } };
  }
  const res = await fetch(`${PAYSTACK_BASE}/bank/resolve_bvn/${bvn}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  return res.json();
}

// ── POST /api/identity-verify/nin — verify NIN ───────────────────────────────
router.post('/nin', authenticate, async (req, res) => {
  try {
    const { nin } = req.body;
    if (!nin || !/^\d{11}$/.test(nin)) {
      return res.status(400).json({ error: 'NIN must be exactly 11 digits' });
    }

    // Check existing
    const existing = await sql`
      SELECT * FROM identity_verifications
      WHERE user_id = ${req.user.id} AND verification_type = 'nin'
    `;
    if (existing.length && existing[0].verified) {
      return res.json({ verified: true, cached: true, first_name: existing[0].first_name, last_name: existing[0].last_name });
    }

    const paystackRes = await paystackVerifyNIN(nin);
    const data = paystackRes.data;

    if (!paystackRes.status || !data) {
      return res.status(422).json({ error: 'NIN could not be verified. Check the number and try again.' });
    }

    const [record] = await sql`
      INSERT INTO identity_verifications (
        user_id, verification_type, document_number,
        first_name, last_name, verified, verification_provider,
        raw_response, verified_at
      ) VALUES (
        ${req.user.id}, 'nin', ${nin},
        ${data.first_name ?? null}, ${data.last_name ?? null},
        true, 'paystack', ${JSON.stringify(paystackRes)}::jsonb, NOW()
      )
      ON CONFLICT (user_id, verification_type) DO UPDATE SET
        document_number       = EXCLUDED.document_number,
        first_name            = EXCLUDED.first_name,
        last_name             = EXCLUDED.last_name,
        verified              = true,
        verified_at           = NOW(),
        raw_response          = EXCLUDED.raw_response
      RETURNING *
    `;

    // Mark cook profile as identity verified
    await sql`
      UPDATE cook_profiles SET identity_verified = true, identity_verified_at = NOW()
      WHERE user_id = ${req.user.id}
    `;
    await sql`
      UPDATE users SET id_verified = true WHERE id = ${req.user.id}
    `.catch(() => {});

    res.json({
      verified:   true,
      type:       'nin',
      first_name: data.first_name,
      last_name:  data.last_name,
    });
  } catch (err) {
    console.error('POST /identity-verify/nin:', err);
    res.status(500).json({ error: 'NIN verification failed' });
  }
});

// ── POST /api/identity-verify/bvn — verify BVN ───────────────────────────────
router.post('/bvn', authenticate, async (req, res) => {
  try {
    const { bvn } = req.body;
    if (!bvn || !/^\d{11}$/.test(bvn)) {
      return res.status(400).json({ error: 'BVN must be exactly 11 digits' });
    }

    const existing = await sql`
      SELECT * FROM identity_verifications
      WHERE user_id = ${req.user.id} AND verification_type = 'bvn'
    `;
    if (existing.length && existing[0].verified) {
      return res.json({ verified: true, cached: true, first_name: existing[0].first_name, last_name: existing[0].last_name });
    }

    const paystackRes = await paystackVerifyBVN(bvn);
    const data = paystackRes.data;

    if (!paystackRes.status || !data) {
      return res.status(422).json({ error: 'BVN could not be verified. Check the number and try again.' });
    }

    await sql`
      INSERT INTO identity_verifications (
        user_id, verification_type, document_number,
        first_name, last_name, verified, verification_provider,
        raw_response, verified_at
      ) VALUES (
        ${req.user.id}, 'bvn', ${bvn},
        ${data.first_name ?? null}, ${data.last_name ?? null},
        true, 'paystack', ${JSON.stringify(paystackRes)}::jsonb, NOW()
      )
      ON CONFLICT (user_id, verification_type) DO UPDATE SET
        document_number  = EXCLUDED.document_number,
        first_name       = EXCLUDED.first_name,
        last_name        = EXCLUDED.last_name,
        verified         = true,
        verified_at      = NOW()
    `;

    await sql`
      UPDATE cook_profiles SET identity_verified = true, identity_verified_at = NOW()
      WHERE user_id = ${req.user.id}
    `;

    res.json({
      verified:   true,
      type:       'bvn',
      first_name: data.first_name,
      last_name:  data.last_name,
    });
  } catch (err) {
    console.error('POST /identity-verify/bvn:', err);
    res.status(500).json({ error: 'BVN verification failed' });
  }
});

// ── GET /api/identity-verify/status — check caller's identity status ──────────
router.get('/status', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT verification_type, verified, verified_at, first_name, last_name
      FROM identity_verifications WHERE user_id = ${req.user.id}
    `;
    const cookRows = await sql`
      SELECT identity_verified, identity_verified_at FROM cook_profiles WHERE user_id = ${req.user.id}
    `;
    res.json({
      verifications:     rows,
      identity_verified: cookRows[0]?.identity_verified ?? false,
      verified_at:       cookRows[0]?.identity_verified_at ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ── GET /api/identity-verify/admin/all — admin view ───────────────────────────
router.get('/admin/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { verified, type, limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT iv.*, u.full_name, u.phone
      FROM identity_verifications iv
      JOIN users u ON u.id = iv.user_id
      WHERE (${verified != null ? sql`iv.verified = ${verified === 'true'}` : sql`TRUE`})
        AND (${type ? sql`iv.verification_type = ${type}` : sql`TRUE`})
      ORDER BY iv.created_at DESC
      LIMIT ${+limit} OFFSET ${+offset}
    `;
    res.json({ verifications: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

module.exports = router;
