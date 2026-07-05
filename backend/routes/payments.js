const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const ledger = require('../payments/ledger');
const crypto = require('crypto');

// Gateway calls now go through the payment orchestrator (payments/orchestrator.js),
// never a hard-coded Flutterwave client. This route owns FOODS business logic
// (orders, notifications, idempotency); the orchestrator owns which rail moves
// the money. Adding a second connector requires no change to this file.

/**
 * Post an order's payment capture into the double-entry ledger (Phase 3 slice 3a).
 * `order` is a row from the payment-confirmation UPDATE and carries the minor-unit
 * amounts. The customer's total splits into three destinations:
 *   debit  platform gateway_clearing   total
 *   credit cook     escrow             cook_payout   (held until escrow release)
 *   credit platform revenue            fees          (total − cook_payout − delivery)
 *   credit platform delivery_clearing  delivery_fee  (owed to the courier)
 * Zero legs are omitted (the ledger requires positive amounts). Runs in its own
 * transaction so the legs are atomic. Idempotent via the per-order `ref`.
 */
async function postOrderCapture(order) {
  const total    = Number(order.total_amount_minor ?? 0);
  const payout   = Number(order.cook_payout_minor ?? 0);
  const delivery = Number(order.delivery_fee_minor ?? 0);
  const revenue  = total - payout - delivery;
  if (total <= 0) return; // nothing to capture (e.g. free item, no delivery)

  const currency = order.currency_code ?? 'NGN';
  await sql.begin(async sql => {
    const gateway = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'gateway_clearing', currency });
    const legs = [{ accountId: gateway, direction: 'debit', amount_minor: total }];

    if (payout > 0) {
      const escrow = await ledger.ensureAccount(sql, { ownerType: 'cook', ownerId: order.cook_id, accountType: 'escrow', currency });
      legs.push({ accountId: escrow, direction: 'credit', amount_minor: payout });
    }
    if (revenue > 0) {
      const rev = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'revenue', currency });
      legs.push({ accountId: rev, direction: 'credit', amount_minor: revenue });
    }
    if (delivery > 0) {
      const deliveryClearing = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'delivery_clearing', currency });
      legs.push({ accountId: deliveryClearing, direction: 'credit', amount_minor: delivery });
    }

    await ledger.post(sql, {
      transactionId: crypto.randomUUID(),
      currency,
      entryType: 'order_capture',
      description: 'Order payment captured',
      ref: `order-capture:${order.id}`,
      legs,
    });
  });
}

// ── POST /api/payments/initiate ─────────────────────────────────────────────
// Returns a payment link for the selected connector's hosted checkout.
router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'NGN', redirect_url, cart_items, meta } = req.body;

    if (!amount || !redirect_url) {
      return res.status(400).json({ error: 'amount and redirect_url are required' });
    }

    const tx_ref = `FBM-${Date.now()}-${req.user.id.slice(0, 8)}`;

    // Get user info for the charge payload
    const users = await sql`SELECT full_name, email, phone FROM users WHERE id = ${req.user.id}`;
    const user = users[0];

    try {
      const { reference, redirectLink, devMode } = await orchestrator.createCharge({
        amount,
        currency,
        reference: tx_ref,
        redirectUrl: redirect_url,
        customer: {
          email: user.email ?? `${req.user.id}@foodsbyme.app`,
          phone: user.phone,
          name: user.full_name ?? 'FOODSbyme Customer',
        },
        description: `${cart_items?.length ?? 1} meal(s)`,
        meta: { user_id: req.user.id, ...meta },
      }, { country: req.body.country });

      if (devMode) {
        return res.json({ tx_ref: reference, payment_link: null, dev_mode: true });
      }
      return res.json({ tx_ref: reference, payment_link: redirectLink });
    } catch (chargeErr) {
      if (chargeErr.code === 'CONNECTOR_CHARGE_FAILED') {
        console.error('Payment init error:', chargeErr.detail ?? chargeErr.message);
        return res.status(502).json({ error: 'Payment provider error', detail: chargeErr.message });
      }
      if (chargeErr.code === 'NO_PAYMENT_ROUTE') {
        return res.status(400).json({ error: 'No payment method available for this region/currency' });
      }
      throw chargeErr;
    }
  } catch (err) {
    console.error('POST /payments/initiate:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// ── POST /api/payments/verify ───────────────────────────────────────────────
// Verify a transaction server-side after redirect (never trust the redirect itself)
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { tx_ref, transaction_id, expected_amount } = req.body;

    if (!tx_ref && !transaction_id) {
      return res.status(400).json({ error: 'tx_ref or transaction_id required' });
    }

    const status = await orchestrator.verifyCharge({ reference: tx_ref, providerTxId: transaction_id });

    if (status.devMode) {
      console.log('[DEV] Payment verified (mock):', tx_ref ?? transaction_id);
      return res.json({ verified: true, tx_ref, transaction_id, dev_mode: true });
    }

    if (!status.successful) {
      return res.status(400).json({ error: 'Payment not successful', detail: status.raw });
    }

    // Verify the paid amount covers the expected order total (prevents underpayment attacks)
    if (expected_amount != null) {
      const paidAmount = parseFloat(status.amount);
      const requiredAmount = parseFloat(expected_amount);
      if (paidAmount < requiredAmount - 0.01) { // 1 kobo tolerance for FP rounding
        return res.status(400).json({
          error: `Payment amount (${paidAmount}) is less than required (${requiredAmount})`,
        });
      }
    }

    return res.json({
      verified: true,
      tx_ref: status.reference,
      amount: status.amount,
      currency: status.currency,
      payment_method: status.method,
      transaction_id: status.providerTxId,
    });
  } catch (err) {
    console.error('POST /payments/verify:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ── POST /api/payments/webhook ──────────────────────────────────────────────
// Provider webhook — called by the gateway, no auth middleware.
router.post('/webhook', async (req, res) => {
  try {
    const result = orchestrator.ingestWebhook('flutterwave', req.headers, req.body);

    if (!result.ok) {
      if (result.reason === 'no_secret') {
        console.error('[Webhook] FLUTTERWAVE_WEBHOOK_HASH not set — rejecting all webhooks in production');
      }
      return res.status(401).send('Unauthorized');
    }

    const event = result.event;
    const rawEventType = req.body?.event ?? event.type;

    // Idempotency: skip duplicate webhook deliveries
    try {
      await sql`
        INSERT INTO processed_webhooks (provider, event_type, reference)
        VALUES ('flutterwave', ${rawEventType}, ${event.dedupeKey})
      `;
    } catch (dupErr) {
      const msg = String(dupErr?.message ?? dupErr);
      if (dupErr?.code === '23505' || msg.includes('unique') || msg.includes('duplicate')) {
        console.log('[Webhook] Duplicate event, skipping:', rawEventType, event.dedupeKey);
        return res.status(200).send('OK');
      }
      throw dupErr;
    }

    if (event.type === 'charge.succeeded') {
      const tx_ref = event.reference;
      const rows = await sql`
        UPDATE orders
        SET status            = 'payment_confirmed',
            flutterwave_tx_id = ${event.providerTxId ?? null},
            updated_at        = NOW()
        WHERE flutterwave_tx_ref = ${tx_ref} AND status = 'pending_payment'
        RETURNING id, customer_id, cook_id, currency_code,
                  total_amount_minor, cook_payout_minor, delivery_fee_minor
      `;
      for (const row of rows) {
        // Phase 3 slice 3a — mirror the capture into the double-entry ledger.
        // The gateway-cleared funds split into the cook's escrow (held until
        // release), platform revenue (the fees), and delivery clearing (owed to
        // the courier). This is a parallel mirror: nothing derives balances from
        // it yet, so a posting failure must NOT block the payment confirmation
        // (the customer has already paid). Each capture posts in its own
        // transaction so its legs are atomic; the `ref` makes it idempotent for a
        // future backfill. When balances are later derived from the ledger, this
        // will be tightened to be fully atomic with the status transition.
        await postOrderCapture(row).catch(err => {
          console.error(`[Webhook] Ledger capture failed for order ${row.id} (confirmation stands):`, err.message);
        });

        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (${row.customer_id}, 'order_payment_confirmed',
                  'Payment confirmed', 'Your payment was received. Waiting for cook to accept.',
                  ${{ order_id: row.id }}::jsonb)
        `;
      }
      console.log('[Webhook] Payment confirmed for tx_ref:', tx_ref, '— orders updated:', rows.length);
    }

    if (event.type === 'charge.failed') {
      const tx_ref = event.reference;
      const rows = await sql`
        UPDATE orders
        SET status     = 'payment_failed',
            updated_at = NOW()
        WHERE flutterwave_tx_ref = ${tx_ref} AND status = 'pending_payment'
        RETURNING id, customer_id
      `;
      for (const row of rows) {
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (${row.customer_id}, 'payment_failed',
                  'Payment failed', 'Your payment was unsuccessful. Tap to retry.',
                  ${{ order_id: row.id }}::jsonb)
        `;
      }
      console.log('[Webhook] Payment failed for tx_ref:', tx_ref, '— orders updated:', rows.length);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
});

module.exports = router;
