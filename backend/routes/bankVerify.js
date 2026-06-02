const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const FW_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
const FW_BASE   = 'https://api.flutterwave.com/v3';

async function flutterwaveResolveAccount(accountNumber, bankCode) {
  if (!FW_SECRET) {
    return { account_name: 'MOCK ACCOUNT NAME', account_number: accountNumber };
  }
  const res = await fetch(
    `${FW_BASE}/accounts/resolve?account_number=${accountNumber}&account_bank=${bankCode}`,
    { headers: { Authorization: `Bearer ${FW_SECRET}` } }
  );
  const data = await res.json();
  if (data.status !== 'success' || !data.data?.account_name) return null;
  return data.data;
}

async function flutterwaveListBanks() {
  if (!FW_SECRET) return [];
  const res = await fetch(`${FW_BASE}/banks/NG`, {
    headers: { Authorization: `Bearer ${FW_SECRET}` },
  });
  const data = await res.json();
  return data.data ?? [];
}

// ── POST /api/bank-verify — verify a cook's bank account via Flutterwave ──────
router.post('/', authenticate, async (req, res) => {
  try {
    const { account_number, bank_code, bank_name } = req.body;
    if (!account_number || !bank_code) {
      return res.status(400).json({ error: 'account_number and bank_code required' });
    }
    if (!/^\d{10}$/.test(account_number)) {
      return res.status(400).json({ error: 'Account number must be exactly 10 digits' });
    }

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    // Return cached verified record if already done
    const existing = await sql`
      SELECT * FROM bank_verifications
      WHERE user_id = ${req.user.id}
        AND account_number = ${account_number}
        AND bank_code = ${bank_code}
        AND verified = true
    `;
    if (existing.length) {
      return res.json({
        verified:     true,
        account_name: existing[0].account_name,
        bank_name:    existing[0].bank_name,
        cached:       true,
      });
    }

    let resolved;
    try {
      resolved = await flutterwaveResolveAccount(account_number, bank_code);
    } catch (e) {
      console.error('FW resolve error:', e);
      return res.status(502).json({ error: 'Bank verification service unavailable. Try again shortly.' });
    }

    if (!resolved) {
      return res.status(422).json({ error: 'Could not verify account. Check your account number and bank selection.' });
    }

    const [record] = await sql`
      INSERT INTO bank_verifications (
        user_id, cook_id, account_number, bank_code,
        account_name, bank_name, verified, verification_provider, verified_at
      ) VALUES (
        ${req.user.id}, ${cookId}, ${account_number}, ${bank_code},
        ${resolved.account_name}, ${bank_name ?? null},
        true, 'flutterwave', NOW()
      )
      ON CONFLICT (user_id, account_number, bank_code) DO UPDATE SET
        account_name = EXCLUDED.account_name,
        bank_name    = EXCLUDED.bank_name,
        verified     = true,
        verified_at  = NOW()
      RETURNING *
    `;

    await sql`
      UPDATE cook_profiles SET
        bank_account_number = ${account_number},
        bank_account_name   = ${resolved.account_name},
        bank_code           = ${bank_code},
        bank_name           = ${bank_name ?? null},
        bank_verified       = true,
        bank_verified_at    = NOW()
      WHERE user_id = ${req.user.id}
    `;

    res.json({
      verified:       true,
      account_name:   resolved.account_name,
      account_number,
      bank_name:      bank_name ?? null,
      bank_code,
      record_id:      record.id,
    });
  } catch (err) {
    console.error('POST /bank-verify:', err);
    res.status(500).json({ error: 'Bank verification failed' });
  }
});

// ── GET /api/bank-verify/status ───────────────────────────────────────────────
router.get('/status', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT bank_verified, bank_verified_at, bank_account_name,
             bank_account_number, bank_name, bank_code
      FROM cook_profiles WHERE user_id = ${req.user.id}
    `;
    if (!rows.length) return res.json({ verified: false });
    const c = rows[0];
    res.json({
      verified:       c.bank_verified ?? false,
      verified_at:    c.bank_verified_at,
      account_name:   c.bank_account_name,
      account_number: c.bank_account_number,
      bank_name:      c.bank_name,
      bank_code:      c.bank_code,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

// ── GET /api/bank-verify/banks — Nigerian bank list from Flutterwave ──────────
router.get('/banks', authenticate, async (req, res) => {
  try {
    const banks = await flutterwaveListBanks();
    res.json({ banks: banks.map(b => ({ name: b.name, code: b.code })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bank list' });
  }
});

// ── GET /api/bank-verify/admin/all — admin view ───────────────────────────────
router.get('/admin/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { verified, limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT bv.*, u.full_name, u.phone, cp.display_name AS cook_name
      FROM bank_verifications bv
      JOIN users u ON u.id = bv.user_id
      LEFT JOIN cook_profiles cp ON cp.user_id = bv.user_id
      WHERE (${verified != null ? sql`bv.verified = ${verified === 'true'}` : sql`TRUE`})
      ORDER BY bv.created_at DESC
      LIMIT ${+limit} OFFSET ${+offset}
    `;
    res.json({ verifications: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

module.exports = router;
