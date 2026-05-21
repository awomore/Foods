const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const FW_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
const FW_BASE   = 'https://api.flutterwave.com/v3';

// ── POST /api/payments/initiate ─────────────────────────────────────────────
// Returns a payment link for the Flutterwave inline charge
router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { amount, currency = 'NGN', redirect_url, cart_items, meta } = req.body;

    if (!amount || !redirect_url) {
      return res.status(400).json({ error: 'amount and redirect_url are required' });
    }

    const tx_ref = `FBM-${Date.now()}-${req.user.id.slice(0, 8)}`;

    // Get user info for Flutterwave payload
    const users = await sql`SELECT full_name, email, phone FROM users WHERE id = ${req.user.id}`;
    const user = users[0];

    const payload = {
      tx_ref,
      amount: parseFloat(amount).toFixed(2),
      currency,
      redirect_url,
      customer: {
        email: user.email ?? `${req.user.id}@foodsbyme.app`,
        phonenumber: user.phone,
        name: user.full_name ?? 'FOODSbyme Customer',
      },
      customizations: {
        title: 'FOODSbyme',
        description: `${cart_items?.length ?? 1} meal(s)`,
        logo: 'https://foodsbyme.com/logo.png',
      },
      meta: { user_id: req.user.id, ...meta },
    };

    if (FW_SECRET) {
      const fwRes = await fetch(`${FW_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${FW_SECRET}`,
        },
        body: JSON.stringify(payload),
      });
      const fwData = await fwRes.json();

      if (fwData.status !== 'success') {
        console.error('Flutterwave payment init error:', fwData);
        return res.status(502).json({ error: 'Payment provider error', detail: fwData.message });
      }

      return res.json({ tx_ref, payment_link: fwData.data.link });
    }

    // Dev mode: return a mock link
    console.log('[DEV] Payment initiated:', tx_ref, 'Amount:', amount, currency);
    res.json({ tx_ref, payment_link: null, dev_mode: true });
  } catch (err) {
    console.error('POST /payments/initiate:', err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// ── POST /api/payments/verify ───────────────────────────────────────────────
// Verify a Flutterwave transaction after redirect
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { tx_ref, transaction_id } = req.body;

    if (!tx_ref && !transaction_id) {
      return res.status(400).json({ error: 'tx_ref or transaction_id required' });
    }

    if (FW_SECRET) {
      const endpoint = transaction_id
        ? `${FW_BASE}/transactions/${transaction_id}/verify`
        : `${FW_BASE}/transactions/verify_by_reference?tx_ref=${tx_ref}`;

      const fwRes = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${FW_SECRET}` },
      });
      const fwData = await fwRes.json();

      if (fwData.status !== 'success' || fwData.data?.status !== 'successful') {
        return res.status(400).json({ error: 'Payment not successful', detail: fwData });
      }

      return res.json({
        verified: true,
        tx_ref: fwData.data.tx_ref,
        amount: fwData.data.amount,
        currency: fwData.data.currency,
        payment_method: fwData.data.payment_type,
        transaction_id: fwData.data.id,
      });
    }

    // Dev mode: treat all verifications as successful
    console.log('[DEV] Payment verified (mock):', tx_ref ?? transaction_id);
    res.json({ verified: true, tx_ref, transaction_id, dev_mode: true });
  } catch (err) {
    console.error('POST /payments/verify:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ── POST /api/payments/webhook ──────────────────────────────────────────────
// Flutterwave webhook — called by FW, no auth middleware
router.post('/webhook', async (req, res) => {
  try {
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    const signature = req.headers['verif-hash'];

    if (secretHash && signature !== secretHash) {
      return res.status(401).send('Unauthorized');
    }

    const { event, data } = req.body;

    if (event === 'charge.completed' && data.status === 'successful') {
      const { tx_ref } = data;
      // Look up and confirm orders with this tx_ref
      await sql`
        UPDATE orders
        SET status = 'confirmed', payment_tx_id = ${String(data.id)}, updated_at = NOW()
        WHERE payment_tx_ref = ${tx_ref} AND status = 'pending_payment'
      `;
      console.log('[Webhook] Payment confirmed for tx_ref:', tx_ref);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
});

module.exports = router;
