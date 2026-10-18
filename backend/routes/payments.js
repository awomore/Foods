const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { orchestrator } = require('../payments/orchestrator');
const { confirmOrderCharge } = require('../payments/confirmOrderCharge');
const { settlePayoutSuccess, settlePayoutFailure, resolvePayoutId } = require('../payments/payoutSettlement');

// Gateway calls now go through the payment orchestrator (payments/orchestrator.js),
// never a hard-coded Flutterwave client. This route owns FOODS business logic
// (orders, notifications, idempotency); the orchestrator owns which rail moves
// the money. Adding a second connector requires no change to this file.
//
// The ledger split logic (buyer total → cook escrow + platform revenue +
// delivery clearing) lives in payments/orderCapture.js so the webhook here, the
// wallet-paid path (routes/orders.js) and the reconciliation cron
// (services/scheduler.js) all post an identical, idempotent capture.

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
      const { reference, redirectLink, devMode, connector } = await orchestrator.createCharge({
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
        // user_id last: it is what payments/claims.js trusts as the payer, so
        // client-supplied meta must not be able to overwrite it.
        meta: { ...meta, user_id: req.user.id },
      }, { country: req.body.country });

      if (devMode) {
        return res.json({ tx_ref: reference, payment_link: null, dev_mode: true });
      }
      // provider tells the app how to pay: 'bachs' opens payment_link (hosted
      // checkout); 'flutterwave' keeps the app's inline form.
      return res.json({ tx_ref: reference, payment_link: redirectLink, provider: connector });
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

// ── GET /api/payments/return — where a hosted checkout sends the buyer ─────
// The app's in-app browser watches for this URL and closes itself; the page is
// only what a buyer sees if they opened the checkout in a real browser. It says
// nothing about whether the payment worked: only the webhook (or a server-side
// verify) decides that.
router.get('/return', (req, res) => {
  const cancelled = req.query.status === 'cancelled';
  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>FOODSbyme</title>
<style>body{font-family:system-ui,sans-serif;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;text-align:center}</style>
</head><body><div><h1>${cancelled ? 'Payment cancelled' : 'Thanks — finishing up'}</h1>
<p>${cancelled ? 'No money was taken. You can close this page and try again in the app.' : 'You can close this page and return to the FOODSbyme app.'}</p></div></body></html>`);
});

// ── POST /api/payments/webhook — Flutterwave ────────────────────────────────
// Provider webhooks — called by the gateway, no auth middleware.
router.post('/webhook', (req, res) => handleWebhook('flutterwave', req, res));

// ── POST /api/payments/webhook/bachs — Bachs ────────────────────────────────
// Signed over the raw body (server.js keeps it as req.rawBody for this path).
router.post('/webhook/bachs', (req, res) => handleWebhook('bachs', req, res));

async function handleWebhook(provider, req, res) {
  try {
    const result = orchestrator.ingestWebhook(provider, req.headers, req.body, { rawBody: req.rawBody });

    if (!result.ok) {
      if (result.reason === 'no_secret') {
        console.error(`[Webhook] ${provider} signing secret not set — rejecting all webhooks in production`);
      }
      return res.status(401).send('Unauthorized');
    }

    const event = result.event;
    const rawEventType = req.body?.event ?? req.body?.type ?? event.type;

    // Idempotency: skip duplicate webhook deliveries
    try {
      await sql`
        INSERT INTO processed_webhooks (provider, event_type, reference)
        VALUES (${provider}, ${rawEventType}, ${event.dedupeKey})
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
      // The order names its charge, and a successful charge proves only that
      // money arrived, not that it pays for these orders. confirmOrderCharge
      // checks payer, currency, amount and prior use, then confirms + captures
      // (or cancels). It re-verifies with the gateway; if that call fails the
      // orders stay pending and the reconciliation cron retries them.
      const tx_ref = event.reference;
      const { outcome, orders } = await confirmOrderCharge(sql, tx_ref, { providerTxId: event.providerTxId })
        .catch(err => {
          console.error('[Webhook] Could not confirm orders for tx_ref', tx_ref, '(left for reconciliation):', err.message);
          return { outcome: 'deferred', orders: [] };
        });
      console.log('[Webhook] charge.succeeded for tx_ref:', tx_ref, '—', outcome, orders.length, 'order(s)');
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

    // ── Payout (transfer) settlement — the money-OUT side ────────────────────
    // Advances a payout processing → completed / failed. Without this a
    // successful transfer sat at 'processing' forever (mislabelled in the cook's
    // payout history), and a transfer that failed AFTER being accepted never
    // reverted the orders or reversed the ledger draw-down.
    if (event.type === 'transfer.completed' || event.type === 'transfer.failed') {
      const payoutId = await resolvePayoutId(sql, event);
      if (!payoutId) {
        console.warn('[Webhook] transfer event with no resolvable payout:', event.reference, event.providerTxId);
      } else if (event.type === 'transfer.completed') {
        const { settled } = await settlePayoutSuccess(sql, payoutId);
        console.log('[Webhook] Payout completed:', payoutId, settled ? '(settled)' : '(noop — not processing)');
      } else {
        const { settled } = await settlePayoutFailure(sql, payoutId, 'Transfer failed at gateway');
        console.log('[Webhook] Payout failed:', payoutId, settled ? '(reverted)' : '(noop — not processing)');
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
}

module.exports = router;
