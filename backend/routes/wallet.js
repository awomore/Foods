const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const { toMinor, fromMinor } = require('../payments/money');
const ledger = require('../payments/ledger');
const crypto = require('crypto');
const { DEFAULT_CURRENCY, currencyForPhone, normalizeCurrency } = require('../utils/currency');

// A wallet holds one currency. It is fixed by the first top-up and may only
// change while the balance is zero, because there is no FX: crediting a KES
// payment to an NGN balance (or spending NGN on a GHS order) would be a 1:1
// swap of unrelated money. Clients that predate multi-currency send no
// currency; they charge in NGN, so NGN is what they get.
function requestCurrency(body) {
  return body.currency == null ? DEFAULT_CURRENCY : normalizeCurrency(body.currency);
}

// ── GET /api/wallet ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const balRows = await sql`
      SELECT * FROM wallet_balances WHERE customer_id = ${req.user.id}
    `;
    // No wallet yet: report the currency a first top-up would most likely use.
    const balance = balRows[0] ?? {
      balance_minor: 0,
      currency: currencyForPhone((await sql`SELECT phone FROM users WHERE id = ${req.user.id}`)[0]?.phone) ?? DEFAULT_CURRENCY,
    };

    const transactions = await sql`
      SELECT * FROM wallet_transactions
      WHERE customer_id = ${req.user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Balance is sourced from the minor-unit column. `balance_ngn` is the legacy
    // name for the major-unit balance, kept for older clients; it is in
    // `currency`, which is only NGN for NGN wallets.
    const major = fromMinor(balance.balance_minor ?? 0, balance.currency);
    res.json({
      balance: major,
      currency: balance.currency,
      balance_ngn: major,
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

    const currency = requestCurrency(req.body);
    if (!currency) return res.status(400).json({ error: 'currency must be a 3-letter ISO currency code' });

    // Verify payment through the orchestrator before crediting wallet.
    // In dev mode (no live connector) verification is stubbed successful, matching
    // the previous behavior where the FW check was skipped when no secret was set.
    const status = await orchestrator.verifyCharge({ reference: ref });
    if (!status.devMode) {
      if (!status.successful) {
        return res.status(400).json({ error: 'Payment verification failed', detail: status.raw?.message });
      }
      // Confirm amount and ownership
      if (status.currency && String(status.currency).toUpperCase() !== currency) {
        return res.status(400).json({ error: `Payment was made in ${status.currency}, not ${currency}` });
      }
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
    let currencyConflict = null;
    let newTx = null;
    let newBal = null;

    await sql.begin(async sql => {
      await sql`SELECT pg_advisory_xact_lock(('x' || md5(${req.user.id}))::bit(64)::bigint)`;

      const existing = await sql`
        SELECT id FROM wallet_transactions WHERE ref = ${ref} AND customer_id = ${req.user.id}
      `;
      if (existing.length) { alreadyApplied = true; return; }

      const wallet = (await sql`SELECT balance_minor, currency FROM wallet_balances WHERE customer_id = ${req.user.id}`)[0];
      if (wallet && wallet.currency !== currency && Number(wallet.balance_minor) !== 0) {
        currencyConflict = wallet.currency;
        return;
      }

      // Minor units are the sole source of truth; the major value is derived.
      const amountMinor = toMinor(amount, currency);

      // An empty wallet adopts the top-up's currency.
      await sql`
        INSERT INTO wallet_balances (customer_id, balance_minor, currency)
        VALUES (${req.user.id}, ${amountMinor}, ${currency})
        ON CONFLICT (customer_id) DO UPDATE
        SET balance_minor = wallet_balances.balance_minor + ${amountMinor},
            currency      = ${currency},
            updated_at    = NOW()
      `;

      const txRows = await sql`
        INSERT INTO wallet_transactions (customer_id, type, amount_minor, description, ref, currency)
        VALUES (${req.user.id}, 'topup', ${amountMinor}, ${'Wallet top-up'}, ${ref}, ${currency})
        RETURNING *
      `;
      newTx = txRows[0];

      // Mirror the movement into the double-entry ledger (same transaction):
      // money enters from the gateway and lands in the user's wallet.
      const userWallet = await ledger.ensureAccount(sql, { ownerType: 'user', ownerId: req.user.id, accountType: 'wallet', currency });
      const gateway    = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'gateway_clearing', currency });
      await ledger.post(sql, {
        transactionId: crypto.randomUUID(), entryType: 'wallet_topup', description: 'Wallet top-up', ref,
        currency,
        legs: [
          { accountId: gateway,    direction: 'debit',  amount_minor: amountMinor },
          { accountId: userWallet, direction: 'credit', amount_minor: amountMinor },
        ],
      });

      const balRows = await sql`SELECT balance_minor FROM wallet_balances WHERE customer_id = ${req.user.id}`;
      newBal = fromMinor(balRows[0].balance_minor, currency);
    });

    if (alreadyApplied) return res.json({ already_applied: true });
    if (currencyConflict) {
      return res.status(409).json({ error: `Your wallet holds ${currencyConflict}. Spend it down before topping up in ${currency}.` });
    }

    res.status(201).json({ transaction: newTx, balance: newBal, currency, balance_ngn: newBal });
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

    const currency = requestCurrency(req.body);
    if (!currency) return res.status(400).json({ error: 'currency must be a 3-letter ISO currency code' });

    // Debit against the minor-unit balance, which is the source of truth.
    // The balance debit, the transaction row, and the ledger posting run in one
    // transaction so they can't drift apart.
    const amountMinor = toMinor(amount, currency);
    const wallet_tx_ref = `WALLET-${req.user.id.slice(0, 8)}-${Date.now()}`;
    let outcome = { insufficient: true };

    await sql.begin(async sql => {
      // Only a wallet in the order's currency can pay for it.
      const result = await sql`
        UPDATE wallet_balances
        SET balance_minor = balance_minor - ${amountMinor},
            updated_at    = NOW()
        WHERE customer_id = ${req.user.id} AND balance_minor >= ${amountMinor} AND currency = ${currency}
        RETURNING balance_minor
      `;
      if (!result.length) {
        const wallet = (await sql`SELECT currency FROM wallet_balances WHERE customer_id = ${req.user.id}`)[0];
        if (wallet && wallet.currency !== currency) outcome = { wrongCurrency: wallet.currency };
        return; // otherwise outcome stays { insufficient: true }
      }

      await sql`
        INSERT INTO wallet_transactions (customer_id, type, amount_minor, description, ref, currency)
        VALUES (${req.user.id}, 'debit', ${amountMinor}, ${'Order payment'}, ${wallet_tx_ref}, ${currency})
      `;

      // Ledger: money leaves the user's wallet into the platform clearing account.
      const userWallet = await ledger.ensureAccount(sql, { ownerType: 'user', ownerId: req.user.id, accountType: 'wallet', currency });
      const clearing   = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'wallet_clearing', currency });
      await ledger.post(sql, {
        transactionId: crypto.randomUUID(), entryType: 'wallet_pay', description: 'Order payment', ref: wallet_tx_ref,
        currency,
        legs: [
          { accountId: userWallet, direction: 'debit',  amount_minor: amountMinor },
          { accountId: clearing,   direction: 'credit', amount_minor: amountMinor },
        ],
      });

      outcome = { balance_minor: result[0].balance_minor };
    });

    if (outcome.wrongCurrency) {
      return res.status(400).json({ error: `Your wallet holds ${outcome.wrongCurrency} and can't pay in ${currency}` });
    }
    if (outcome.insufficient) return res.status(400).json({ error: 'Insufficient wallet balance' });

    const balance = fromMinor(outcome.balance_minor, currency);
    res.json({ wallet_tx_ref, balance, currency, balance_ngn: balance });
  } catch (err) {
    console.error('POST /wallet/pay:', err);
    res.status(500).json({ error: 'Wallet payment failed' });
  }
});

module.exports = router;
