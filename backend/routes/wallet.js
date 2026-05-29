const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/wallet ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const balRows = await sql`
      SELECT * FROM wallet_balances WHERE customer_id = ${req.user.id}
    `;
    const balance = balRows[0] ?? { balance_ngn: 0 };

    const transactions = await sql`
      SELECT * FROM wallet_transactions
      WHERE customer_id = ${req.user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    res.json({ balance_ngn: parseFloat(balance.balance_ngn ?? 0), transactions });
  } catch (err) {
    console.error('GET /wallet:', err);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// ── POST /api/wallet/topup ────────────────────────────────────────────────────
// Called after a successful Flutterwave payment for wallet top-up
router.post('/topup', authenticate, async (req, res) => {
  try {
    const { amount, tx_ref, flw_ref } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    // Idempotency: prevent double-credit on duplicate webhooks
    const existing = await sql`
      SELECT id FROM wallet_transactions WHERE ref = ${tx_ref ?? flw_ref ?? ''} AND customer_id = ${req.user.id}
    `;
    if (existing.length) return res.json({ already_applied: true });

    await sql`
      INSERT INTO wallet_balances (customer_id, balance_ngn)
      VALUES (${req.user.id}, ${amount})
      ON CONFLICT (customer_id) DO UPDATE
      SET balance_ngn = wallet_balances.balance_ngn + ${amount},
          updated_at  = NOW()
    `;

    const tx = await sql`
      INSERT INTO wallet_transactions (customer_id, type, amount_ngn, description, ref)
      VALUES (${req.user.id}, 'topup', ${amount}, ${'Wallet top-up'}, ${tx_ref ?? flw_ref ?? null})
      RETURNING *
    `;

    const bal = await sql`SELECT balance_ngn FROM wallet_balances WHERE customer_id = ${req.user.id}`;

    res.status(201).json({ transaction: tx[0], balance_ngn: parseFloat(bal[0].balance_ngn) });
  } catch (err) {
    console.error('POST /wallet/topup:', err);
    res.status(500).json({ error: 'Failed to process top-up' });
  }
});

module.exports = router;
