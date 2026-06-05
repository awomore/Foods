const express = require('express');
const router  = express.Router();
const { sql } = require('../supabase/db');
const { authenticate } = require('../middleware/auth');
const {
  getDeliveryStatus,
  cancelDelivery,
  getDeliveryFeeEstimate,
  verifyBoltWebhook,
} = require('../services/logistics');

// ── Bolt status → our order status map ─────────────────────────────────────
const BOLT_TO_ORDER_STATUS = {
  driver_assigned: 'out_for_delivery',
  accepted:        'out_for_delivery',
  picked_up:       'in_transit',
  delivered:       'delivered',
};

// ── POST /api/logistics/bolt/webhook ───────────────────────────────────────
// Receives Bolt status callbacks. Must use raw body for signature verification.
router.post(
  '/bolt/webhook',
  express.raw({ type: '*/*' }),
  async (req, res) => {
    const rawBody  = req.body;
    const signature = req.headers['x-bolt-signature'] ?? req.headers['x-signature'] ?? '';

    if (!verifyBoltWebhook(rawBody, signature)) {
      console.warn('[bolt-webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    console.log('[bolt-webhook] event:', JSON.stringify(event));

    // Bolt may send external_id (our orderId) or order_id in the payload.
    // We store the Bolt tracking ID in rider_tracking_id, so find by that too.
    const boltOrderId  = event.id ?? event.order_id ?? event.tracking_id;
    const externalId   = event.external_id ?? event.external_order_id;
    const boltStatus   = event.status ?? event.event ?? event.event_type;
    const driver       = event.driver ?? event.courier ?? {};
    const eta          = event.estimated_delivery_time ?? event.eta ?? null;

    if (!boltOrderId && !externalId) {
      return res.status(400).json({ error: 'No identifiable order ID in payload' });
    }

    // Resolve our order
    let orders;
    if (externalId) {
      orders = await sql`SELECT * FROM orders WHERE id = ${externalId} LIMIT 1`;
    }
    if (!orders?.length && boltOrderId) {
      orders = await sql`SELECT * FROM orders WHERE rider_tracking_id = ${boltOrderId} LIMIT 1`;
    }

    if (!orders?.length) {
      // Unknown order — ack to prevent retries
      return res.sendStatus(200);
    }

    const order  = orders[0];
    const ourStatus = BOLT_TO_ORDER_STATUS[boltStatus];

    if (ourStatus) {
      const extraFields = ourStatus === 'delivered'
        ? sql`, delivered_at = NOW(), dispute_window_closes_at = NOW() + INTERVAL '30 minutes'`
        : sql``;

      await sql`
        UPDATE orders SET
          status            = ${ourStatus},
          rider_name        = COALESCE(${driver.name  ?? null}, rider_name),
          rider_phone       = COALESCE(${driver.phone ?? null}, rider_phone),
          estimated_arrival = COALESCE(${eta}::timestamptz, estimated_arrival),
          updated_at        = NOW()
          ${extraFields}
        WHERE id = ${order.id}
      `;

      console.log(`[bolt-webhook] Order ${order.id} → ${ourStatus}`);
    } else if (boltStatus === 'cancelled') {
      // Bolt cancelled the courier — notify cook but don't cancel the food order
      console.warn(`[bolt-webhook] Courier cancelled for order ${order.id}. Cook must re-dispatch.`);
      await sql`
        UPDATE orders SET
          rider_tracking_id = NULL,
          rider_name        = NULL,
          rider_phone       = NULL,
          updated_at        = NOW()
        WHERE id = ${order.id}
      `;
      // TODO: push notification to cook to re-dispatch
    }

    res.sendStatus(200);
  }
);

// ── GET /api/logistics/status/:trackingId ──────────────────────────────────
router.get('/status/:trackingId', authenticate, async (req, res) => {
  try {
    const result = await getDeliveryStatus(req.params.trackingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/logistics/estimate ───────────────────────────────────────────
router.post('/estimate', authenticate, async (req, res) => {
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;
  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return res.status(400).json({ error: 'pickupLat, pickupLng, dropoffLat, dropoffLng required' });
  }
  try {
    const result = await getDeliveryFeeEstimate({
      pickupLat:  Number(pickupLat),
      pickupLng:  Number(pickupLng),
      dropoffLat: Number(dropoffLat),
      dropoffLng: Number(dropoffLng),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/logistics/cancel/:trackingId ─────────────────────────────────
router.post('/cancel/:trackingId', authenticate, async (req, res) => {
  try {
    const result = await cancelDelivery(req.params.trackingId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
