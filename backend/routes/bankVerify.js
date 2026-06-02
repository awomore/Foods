const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE   = 'https://api.paystack.co';

async function paystackResolveAccount(accountNumber, bankCode) {
  if (!PAYSTACK_SECRET) {
    // Dev mode: return a mock verified response
    return {
      status:       true,
      account_name: 'MOCK ACCOUNT NAME',
      account_number: accountNumber,
    };
  }

  const res = await fetch(
    `${PAYSTACK_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );
  const data = await res.json();
  return data.data ?? null;
}

async function paystackListBanks() {
  const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria&use_cursor=false&perPage=200`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const data = await res.json();
  return data.data ?? [];
}

// ── POST /api/bank-verify — verify a cook's bank account via Paystack ─────────
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

    // Check for existing verified record
    const existing = await sql`
      SELECT * FROM bank_verifications
      WHERE user_id = ${req.user.id} AND account_number = ${account_number} AND bank_code = ${bank_code}
    `;
    if (existing.length && existing[0].verified) {
      return res.json({
        verified:     true,
        account_name: existing[0].account_name,
        bank_name:    existing[0].bank_name,
        cached:       true,
      });
    }

    // Call Paystack resolve
    let resolved;
    try {
      resolved = await paystackResolveAccount(account_number, bank_code);
    } catch (e) {
      console.error('Paystack resolve error:', e);
      return res.status(502).json({ error: 'Bank verification service unavailable' });
    }

    if (!resolved || !resolved.account_name) {
      return res.status(422).json({ error: 'Could not verify account. Check your account number and bank.' });
    }

    // Persist verification
    const [record] = await sql`
      INSERT INTO bank_verifications (
        user_id, cook_id, account_number, bank_code,
        account_name, bank_name, verified, verification_provider, verified_at
      ) VALUES (
        ${req.user.id}, ${cookId}, ${account_number}, ${bank_code},
        ${resolved.account_name}, ${bank_name ?? null}, true, 'paystack', NOW()
      )
      ON CONFLICT (user_id, account_number, bank_code) DO UPDATE SET
        account_name          = EXCLUDED.account_name,
        bank_name             = EXCLUDED.bank_name,
        verified              = true,
        verified_at           = NOW()
      RETURNING *
    `;

    // Update cook_profiles with verified bank details
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
      verified:     true,
      account_name: resolved.account_name,
      account_number,
      bank_name:    bank_name ?? null,
      bank_code,
      record_id:    record.id,
    });
  } catch (err) {
    console.error('POST /bank-verify:', err);
    res.status(500).json({ error: 'Bank verification failed' });
  }
});

// ── GET /api/bank-verify/status — check if caller's bank is verified ──────────
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

// ── GET /api/bank-verify/banks — list Nigerian banks from Paystack ─────────────
router.get('/banks', authenticate, async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      // Return a fallback list if no key configured
      return res.json({ banks: [] });
    }
    const banks = await paystackListBanks();
    res.json({ banks: banks.map(b => ({ name: b.name, code: b.code })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bank list' });
  }
});

// ── GET /api/bank-verify/admin/all — admin: all bank verifications ─────────────
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
