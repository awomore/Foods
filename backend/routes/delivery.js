const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const fez = require('../services/fezDelivery');

// Webhook URL for Fez dashboard: https://foodsbyme-api-production.up.railway.app/api/delivery/webhook

// ── GET /api/delivery/quote ──────────────────────────────────────────────────
// Returns a Fez delivery cost estimate for a given cook + recipient state.
router.get('/quote', authenticate, async (req, res) => {
  try {
    const { cookId, recipientState, weight = '1' } = req.query;
    if (!cookId || !recipientState) {
      return res.status(400).json({ error: 'cookId and recipientState are required' });
    }

    const cooks = await sql`
      SELECT admin_area, location FROM cook_profiles WHERE id = ${cookId} LIMIT 1
    `;
    if (!cooks.length) return res.status(404).json({ error: 'Cook not found' });

    const pickUpState = cooks[0].admin_area ?? 'Lagos';
    const quote = await fez.getQuote(pickUpState, recipientState, parseFloat(weight));

    res.json({ ...quote, pickUpState, recipientState });
  } catch (err) {
    console.error('GET /delivery/quote:', err.message);
    // Return a zero fee so checkout doesn't break if Fez is unreachable
    res.json({ fee: 0, currency: 'NGN', pickUpState: '', recipientState: req.query.recipientState ?? '', error: 'quote_unavailable' });
  }
});

// ── POST /api/delivery/webhook ───────────────────────────────────────────────
// Fez posts { orderNumber, status } here when delivery status changes.
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const { orderNumber, status } = req.body ?? {};
    if (!orderNumber || !status) {
      return res.status(400).json({ error: 'orderNumber and status required' });
    }

    // Map Fez status → our order status
    const statusMap = {
      'PICKED_UP':       'out_for_delivery',
      'IN_TRANSIT':      'in_transit',
      'DELIVERED':       'delivered',
      'FAILED':          null,  // keep current status
      'CANCELLED':       null,
    };

    const fezUpper   = String(status).toUpperCase().replace(/[^A-Z_]/g, '_');
    const ourStatus  = statusMap[fezUpper];

    if (ourStatus) {
      await sql`
        UPDATE orders
        SET status     = ${ourStatus},
            updated_at = NOW()
        WHERE fez_order_number = ${orderNumber}
          AND status NOT IN ('delivered','completed','cancelled','refunded')
      `;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('POST /delivery/webhook:', err.message);
    res.json({ received: true });  // always 200 so Fez stops retrying
  }
});

module.exports = router;
