const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const { toMinor, fromMinor } = require('../payments/money');
const ledger = require('../payments/ledger');
const crypto = require('crypto');

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

      // Mirror the movement into the double-entry ledger (same transaction):
      // money enters from the gateway and lands in the user's wallet.
      const userWallet = await ledger.ensureAccount(sql, { ownerType: 'user', ownerId: req.user.id, accountType: 'wallet' });
      const gateway    = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'gateway_clearing' });
      await ledger.post(sql, {
        transactionId: crypto.randomUUID(), entryType: 'wallet_topup', description: 'Wallet top-up', ref,
        legs: [
          { accountId: gateway,    direction: 'debit',  amount_minor: amountMinor },
          { accountId: userWallet, direction: 'credit', amount_minor: amountMinor },
        ],
      });

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
    // The balance debit, the transaction row, and the ledger posting run in one
    // transaction so they can't drift apart.
    const amountMinor = toMinor(amount);
    const wallet_tx_ref = `WALLET-${req.user.id.slice(0, 8)}-${Date.now()}`;
    let outcome = { insufficient: true };

    await sql.begin(async sql => {
      const result = await sql`
        UPDATE wallet_balances
        SET balance_minor = balance_minor - ${amountMinor},
            updated_at    = NOW()
        WHERE customer_id = ${req.user.id} AND balance_minor >= ${amountMinor}
        RETURNING balance_minor
      `;
      if (!result.length) return; // outcome stays { insufficient: true }

      await sql`
        INSERT INTO wallet_transactions (customer_id, type, amount_minor, description, ref)
        VALUES (${req.user.id}, 'debit', ${amountMinor}, ${'Order payment'}, ${wallet_tx_ref})
      `;

      // Ledger: money leaves the user's wallet into the platform clearing account.
      const userWallet = await ledger.ensureAccount(sql, { ownerType: 'user', ownerId: req.user.id, accountType: 'wallet' });
      const clearing   = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'wallet_clearing' });
      await ledger.post(sql, {
        transactionId: crypto.randomUUID(), entryType: 'wallet_pay', description: 'Order payment', ref: wallet_tx_ref,
        legs: [
          { accountId: userWallet, direction: 'debit',  amount_minor: amountMinor },
          { accountId: clearing,   direction: 'credit', amount_minor: amountMinor },
        ],
      });

      outcome = { balance_minor: result[0].balance_minor };
    });

    if (outcome.insufficient) return res.status(400).json({ error: 'Insufficient wallet balance' });

    res.json({ wallet_tx_ref, balance_ngn: fromMinor(outcome.balance_minor) });
  } catch (err) {
    console.error('POST /wallet/pay:', err);
    res.status(500).json({ error: 'Wallet payment failed' });
  }
});

module.exports = router;
