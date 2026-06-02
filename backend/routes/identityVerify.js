const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const FW_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
const FW_BASE   = 'https://api.flutterwave.com/v3';

// Flutterwave KYC — BVN
async function flutterwaveVerifyBVN(bvn) {
  if (!FW_SECRET) {
    return { status: 'success', data: { first_name: 'MOCK', last_name: 'USER', bvn } };
  }
  const res = await fetch(`${FW_BASE}/kyc/bvns/${bvn}`, {
    headers: { Authorization: `Bearer ${FW_SECRET}` },
  });
  return res.json();
}

// Flutterwave KYC — NIN
async function flutterwaveVerifyNIN(nin) {
  if (!FW_SECRET) {
    return { status: 'success', data: { first_name: 'MOCK', last_name: 'USER', nin } };
  }
  const res = await fetch(`${FW_BASE}/kyc/nin/${nin}`, {
    headers: { Authorization: `Bearer ${FW_SECRET}` },
  });
  return res.json();
}

// ── POST /api/identity-verify/nin ────────────────────────────────────────────
router.post('/nin', authenticate, async (req, res) => {
  try {
    const { nin } = req.body;
    if (!nin || !/^\d{11}$/.test(nin)) {
      return res.status(400).json({ error: 'NIN must be exactly 11 digits' });
    }

    const existing = await sql`
      SELECT * FROM identity_verifications
      WHERE user_id = ${req.user.id} AND verification_type = 'nin' AND verified = true
    `;
    if (existing.length) {
      return res.json({ verified: true, cached: true, first_name: existing[0].first_name, last_name: existing[0].last_name });
    }

    const fwRes = await flutterwaveVerifyNIN(nin);
    if (fwRes.status !== 'success' || !fwRes.data) {
      return res.status(422).json({ error: 'NIN could not be verified. Check the number and try again.' });
    }

    const data = fwRes.data;
    await sql`
      INSERT INTO identity_verifications (
        user_id, verification_type, document_number,
        first_name, last_name, verified, verification_provider,
        raw_response, verified_at
      ) VALUES (
        ${req.user.id}, 'nin', ${nin},
        ${data.first_name ?? null}, ${data.last_name ?? null},
        true, 'flutterwave', ${JSON.stringify(fwRes)}::jsonb, NOW()
      )
      ON CONFLICT (user_id, verification_type) DO UPDATE SET
        document_number = EXCLUDED.document_number,
        first_name      = EXCLUDED.first_name,
        last_name       = EXCLUDED.last_name,
        verified        = true,
        verified_at     = NOW()
    `;

    await sql`
      UPDATE cook_profiles SET identity_verified = true, identity_verified_at = NOW()
      WHERE user_id = ${req.user.id}
    `;

    res.json({ verified: true, type: 'nin', first_name: data.first_name, last_name: data.last_name });
  } catch (err) {
    console.error('POST /identity-verify/nin:', err);
    res.status(500).json({ error: 'NIN verification failed' });
  }
});

// ── POST /api/identity-verify/bvn ────────────────────────────────────────────
router.post('/bvn', authenticate, async (req, res) => {
  try {
    const { bvn } = req.body;
    if (!bvn || !/^\d{11}$/.test(bvn)) {
      return res.status(400).json({ error: 'BVN must be exactly 11 digits' });
    }

    const existing = await sql`
      SELECT * FROM identity_verifications
      WHERE user_id = ${req.user.id} AND verification_type = 'bvn' AND verified = true
    `;
    if (existing.length) {
      return res.json({ verified: true, cached: true, first_name: existing[0].first_name, last_name: existing[0].last_name });
    }

    const fwRes = await flutterwaveVerifyBVN(bvn);
    if (fwRes.status !== 'success' || !fwRes.data) {
      return res.status(422).json({ error: 'BVN could not be verified. Check the number and try again.' });
    }

    const data = fwRes.data;
    await sql`
      INSERT INTO identity_verifications (
        user_id, verification_type, document_number,
        first_name, last_name, verified, verification_provider,
        raw_response, verified_at
      ) VALUES (
        ${req.user.id}, 'bvn', ${bvn},
        ${data.first_name ?? null}, ${data.last_name ?? null},
        true, 'flutterwave', ${JSON.stringify(fwRes)}::jsonb, NOW()
      )
      ON CONFLICT (user_id, verification_type) DO UPDATE SET
        document_number = EXCLUDED.document_number,
        first_name      = EXCLUDED.first_name,
        last_name       = EXCLUDED.last_name,
        verified        = true,
        verified_at     = NOW()
    `;

    await sql`
      UPDATE cook_profiles SET identity_verified = true, identity_verified_at = NOW()
      WHERE user_id = ${req.user.id}
    `;

    res.json({ verified: true, type: 'bvn', first_name: data.first_name, last_name: data.last_name });
  } catch (err) {
    console.error('POST /identity-verify/bvn:', err);
    res.status(500).json({ error: 'BVN verification failed' });
  }
});

// ── GET /api/identity-verify/status ──────────────────────────────────────────
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

// ── GET /api/identity-verify/admin/all ───────────────────────────────────────
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
