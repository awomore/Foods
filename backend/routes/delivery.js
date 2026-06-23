const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const fez   = require('../services/fezDelivery');
const relay = require('../services/relayDelivery');

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

// ── POST /api/delivery/relay/quote ──────────────────────────────────────────
// Returns a Relay delivery fee for a given cook + customer lat/lng.
// Webhook URL for Relay dashboard:
//   https://foodsbyme-api-production.up.railway.app/api/delivery/relay/webhook
router.post('/relay/quote', authenticate, async (req, res) => {
  try {
    const { cookId, destLat, destLng, estimatedOrderAmount = 0 } = req.body;
    if (!cookId || destLat == null || destLng == null) {
      return res.status(400).json({ error: 'cookId, destLat and destLng are required' });
    }

    const cooks = await sql`
      SELECT latitude, longitude FROM cook_profiles WHERE id = ${cookId} LIMIT 1
    `;
    if (!cooks.length) return res.status(404).json({ error: 'Cook not found' });
    const { latitude: sourceLat, longitude: sourceLng } = cooks[0];

    if (sourceLat == null || sourceLng == null) {
      return res.status(422).json({ error: 'Cook location not set — Relay quote unavailable' });
    }

    const quote = await relay.getQuote({
      sourceLat: Number(sourceLat),
      sourceLng: Number(sourceLng),
      destLat:   Number(destLat),
      destLng:   Number(destLng),
      estimatedOrderAmount: Number(estimatedOrderAmount),
    });

    res.json(quote);
  } catch (err) {
    console.error('POST /delivery/relay/quote:', err.message);
    res.status(502).json({ error: 'relay_quote_unavailable', message: err.message });
  }
});

// ── POST /api/delivery/relay/webhook ────────────────────────────────────────
// Relay posts delivery lifecycle events here.
// Configure this URL in the Relay dashboard under Settings → Developers.
router.post('/relay/webhook', express.json(), async (req, res) => {
  try {
    const { category, payload } = req.body ?? {};
    const reference = payload?.reference ?? payload?.data?.reference;

    if (!reference) {
      return res.status(400).json({ error: 'reference missing from webhook payload' });
    }

    // Map Relay category/status → our order status
    const relayStatus = String(category ?? payload?.status ?? '').toUpperCase();

    const statusMap = {
      'ORDER_ASSIGNED': null,          // rider assigned — don't change order status yet
      'PICKED_UP':      'out_for_delivery',
      'IN_TRANSIT':     'in_transit',
      'DELIVERED':      'delivered',
      'CANCELLED':      null,
      'FAILED':         null,
    };

    const ourStatus = statusMap[relayStatus];

    await sql`
      UPDATE orders
      SET relay_status = ${relayStatus.toLowerCase()},
          updated_at   = NOW()
      WHERE relay_reference = ${reference}
        AND status NOT IN ('delivered','completed','cancelled','refunded')
    `;

    if (ourStatus) {
      await sql`
        UPDATE orders
        SET status     = ${ourStatus},
            updated_at = NOW()
        WHERE relay_reference = ${reference}
          AND status NOT IN ('delivered','completed','cancelled','refunded')
      `;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('POST /delivery/relay/webhook:', err.message);
    res.json({ received: true }); // always 200 so Relay stops retrying
  }
});

module.exports = router;
