const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const { toMinor, fromMinor } = require('../payments/money');

// ── GET /api/wallet ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const balRows = await sql`
      SELECT * FROM wallet_balances WHERE customer_id = ${req.user.id}
    `;
    const balance = balRows[0] ?? { balance_minor: 0, currency: 'NGN' };

    const transactions = await sql`
      SELECT * FROM wallet_transactions
      WHERE customer_id = ${req.user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Balance is now sourced from the minor-unit column; the `balance_ngn`
    // response field is derived so mobile clients see no change.
    res.json({
      balance_ngn: fromMinor(balance.balance_minor ?? 0, balance.currency ?? 'NGN'),
      transactions,
    });
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

    const ref = tx_ref ?? flw_ref;
    if (!ref) return res.status(400).json({ error: 'tx_ref is required' });

    // Verify payment through the orchestrator before crediting wallet.
    // In dev mode (no live connector) verification is stubbed successful, matching
    // the previous behavior where the FW check was skipped when no secret was set.
    const status = await orchestrator.verifyCharge({ reference: ref });
    if (!status.devMode) {
      if (!status.successful) {
        return res.status(400).json({ error: 'Payment verification failed', detail: status.raw?.message });
      }
      // Confirm amount and ownership
      const verifiedAmount = parseFloat(status.amount);
      if (verifiedAmount < parseFloat(amount)) {
        return res.status(400).json({ error: 'Verified payment amount is less than requested top-up' });
      }
      const metaUserId = status.meta?.user_id;
      if (metaUserId && metaUserId !== req.user.id) {
        return res.status(403).json({ error: 'Payment reference does not belong to this account' });
      }
    }

    // Idempotency inside a transaction with an advisory lock keyed on the user.
    // pg_advisory_xact_lock serialises concurrent top-up calls for the same user,
    // preventing the race where two requests both pass the SELECT check before
    // either has inserted the wallet_transactions row.
    let alreadyApplied = false;
    let newTx = null;
    let newBal = null;

    await sql.begin(async sql => {
      await sql`SELECT pg_advisory_xact_lock(('x' || md5(${req.user.id}))::bit(64)::bigint)`;

      const existing = await sql`
        SELECT id FROM wallet_transactions WHERE ref = ${ref} AND customer_id = ${req.user.id}
      `;
      if (existing.length) { alreadyApplied = true; return; }

      // Minor units are the sole source of truth; the naira value is derived.
      const amountMinor = toMinor(amount);

      await sql`
        INSERT INTO wallet_balances (customer_id, balance_minor)
        VALUES (${req.user.id}, ${amountMinor})
        ON CONFLICT (customer_id) DO UPDATE
        SET balance_minor = wallet_balances.balance_minor + ${amountMinor},
            updated_at    = NOW()
      `;

      const txRows = await sql`
        INSERT INTO wallet_transactions (customer_id, type, amount_minor, description, ref)
        VALUES (${req.user.id}, 'topup', ${amountMinor}, ${'Wallet top-up'}, ${ref})
        RETURNING *
      `;
      newTx = txRows[0];

      const balRows = await sql`SELECT balance_minor FROM wallet_balances WHERE customer_id = ${req.user.id}`;
      newBal = fromMinor(balRows[0].balance_minor);
    });

    if (alreadyApplied) return res.json({ already_applied: true });

    res.status(201).json({ transaction: newTx, balance_ngn: newBal });
  } catch (err) {
    console.error('POST /wallet/topup:', err);
    res.status(500).json({ error: 'Failed to process top-up' });
  }
});

// ── POST /api/wallet/pay ─────────────────────────────────────────────────────
// Atomically debit wallet for an order. Returns wallet_tx_ref for order creation.
router.post('/pay', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    // Debit against the minor-unit balance, which is the source of truth.
    const amountMinor = toMinor(amount);
    const result = await sql`
      UPDATE wallet_balances
      SET balance_minor = balance_minor - ${amountMinor},
          updated_at    = NOW()
      WHERE customer_id = ${req.user.id} AND balance_minor >= ${amountMinor}
      RETURNING balance_minor
    `;
    if (!result.length) return res.status(400).json({ error: 'Insufficient wallet balance' });

    const wallet_tx_ref = `WALLET-${req.user.id.slice(0, 8)}-${Date.now()}`;
    await sql`
      INSERT INTO wallet_transactions (customer_id, type, amount_minor, description, ref)
      VALUES (${req.user.id}, 'debit', ${amountMinor}, ${'Order payment'}, ${wallet_tx_ref})
    `;

    res.json({ wallet_tx_ref, balance_ngn: fromMinor(result[0].balance_minor) });
  } catch (err) {
    console.error('POST /wallet/pay:', err);
    res.status(500).json({ error: 'Wallet payment failed' });
  }
});

module.exports = router;
