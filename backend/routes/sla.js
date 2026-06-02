const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const SLA_MINUTES = {
  accepted:    15,   // Cook should accept within 15 min of payment
  preparing:   30,   // Meal should be ready within 30 min of acceptance
  delivery:    60,   // Total delivery within 60 min of accepted
  chef_service: 24 * 60, // Private chef: 24h before event to confirm
};

const PENALTY_DEDUCTIONS = {
  late_acceptance:  5,
  late_preparation: 5,
  late_delivery:    10,
  no_show:          20,
  cancellation:     5,
};

// ── GET /api/sla/order/:orderId — SLA status for an order ─────────────────────
router.get('/order/:orderId', authenticate, async (req, res) => {
  try {
    const orders = await sql`
      SELECT o.*, cp.display_name AS cook_name
      FROM orders o
      JOIN cook_profiles cp ON cp.id = o.cook_id
      WHERE o.id = ${req.params.orderId}
    `;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    const isOwner = order.customer_id === req.user.id || cooks.some(c => c.id === order.cook_id);
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const events = await sql`
      SELECT * FROM sla_events
      WHERE entity_type = 'order' AND entity_id = ${req.params.orderId}
      ORDER BY created_at ASC
    `;

    const now = new Date();
    const promised = order.delivery_promised_at ? new Date(order.delivery_promised_at) : null;
    const slaStatus = {
      promised_at:         order.delivery_promised_at,
      sla_minutes:         order.delivery_sla_minutes ?? SLA_MINUTES.delivery,
      sla_breached:        order.delivery_sla_breached ?? false,
      dispute_window_open: order.dispute_window_closes_at ? now < new Date(order.dispute_window_closes_at) : false,
      dispute_window_closes_at: order.dispute_window_closes_at,
      minutes_remaining:   promised ? Math.max(0, Math.round((promised - now) / 60000)) : null,
    };

    res.json({ order, sla: slaStatus, events });
  } catch (err) {
    console.error('GET /sla/order:', err);
    res.status(500).json({ error: 'Failed to fetch SLA status' });
  }
});

// ── POST /api/sla/order/:orderId/breach — mark SLA breach manually ────────────
// Called by admin or internal worker
router.post('/order/:orderId/breach', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const secret = req.headers['x-worker-secret'];
      if (secret !== process.env.WORKER_SECRET) return res.status(403).json({ error: 'Admin or worker only' });
    }

    const { event_type, minutes_late, apply_penalty } = req.body;
    const orders = await sql`SELECT * FROM orders WHERE id = ${req.params.orderId}`;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    const [event] = await sql`
      INSERT INTO sla_events (entity_type, entity_id, event_type, promised_at, actual_at, minutes_late, penalty_applied)
      VALUES ('order', ${req.params.orderId}, ${event_type ?? 'delivery_late'},
              ${order.delivery_promised_at ?? null}, NOW(), ${minutes_late ?? 0}, ${!!apply_penalty})
      RETURNING *
    `;

    // Mark order sla_breached
    await sql`UPDATE orders SET delivery_sla_breached = true WHERE id = ${req.params.orderId}`;

    // Apply score deduction if requested
    if (apply_penalty && order.cook_id) {
      const cookRow = await sql`SELECT user_id FROM cook_profiles WHERE id = ${order.cook_id}`;
      if (cookRow.length) {
        const deduction = PENALTY_DEDUCTIONS[event_type] ?? 5;
        await sql`
          INSERT INTO sla_penalties (user_id, role, entity_type, entity_id, penalty_type, score_deduction)
          VALUES (${cookRow[0].user_id}, 'cook', 'order', ${req.params.orderId}, ${event_type ?? 'late_delivery'}, ${deduction})
        `;
        await sql`
          UPDATE reliability_scores
          SET score = GREATEST(0, score - ${deduction}), updated_at = NOW()
          WHERE user_id = ${cookRow[0].user_id} AND role = 'cook'
        `;
      }
    }

    res.status(201).json({ event });
  } catch (err) {
    console.error('POST /sla/order/breach:', err);
    res.status(500).json({ error: 'Failed to record SLA breach' });
  }
});

// ── POST /api/sla/worker/check-breaches — batch SLA breach detection ──────────
// Called by cron worker every 5 minutes
router.post('/worker/check-breaches', async (req, res) => {
  const secret = req.headers['x-worker-secret'];
  if (secret !== process.env.WORKER_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Find orders past their SLA window that haven't been marked as breached
    const breachedOrders = await sql`
      SELECT o.id, o.cook_id, o.status, o.delivery_promised_at, o.delivery_sla_minutes,
             o.accepted_at, o.created_at
      FROM orders o
      WHERE o.delivery_sla_breached = false
        AND o.status NOT IN ('delivered','completed','cancelled','refunded')
        AND o.delivery_promised_at IS NOT NULL
        AND o.delivery_promised_at < NOW()
    `;

    let breached = 0;
    for (const order of breachedOrders) {
      const minutesLate = Math.round((Date.now() - new Date(order.delivery_promised_at).getTime()) / 60000);

      await sql`UPDATE orders SET delivery_sla_breached = true WHERE id = ${order.id}`;
      await sql`
        INSERT INTO sla_events (entity_type, entity_id, event_type, promised_at, minutes_late)
        VALUES ('order', ${order.id}, 'delivery_late', ${order.delivery_promised_at}, ${minutesLate})
        ON CONFLICT DO NOTHING
      `.catch(() => {});

      breached++;
    }

    // Check chef bookings past SLA
    const breachedChef = await sql`
      SELECT id, cook_id, sla_deadline
      FROM private_chef_bookings
      WHERE sla_breached = false
        AND status NOT IN ('completed','cancelled')
        AND sla_deadline IS NOT NULL
        AND sla_deadline < NOW()
    `;

    for (const booking of breachedChef) {
      await sql`UPDATE private_chef_bookings SET sla_breached = true WHERE id = ${booking.id}`;
      await sql`
        INSERT INTO sla_events (entity_type, entity_id, event_type, promised_at)
        VALUES ('chef_booking', ${booking.id}, 'breach', ${booking.sla_deadline})
        ON CONFLICT DO NOTHING
      `.catch(() => {});
      breached++;
    }

    res.json({ breached_orders: breachedOrders.length, breached_chef: breachedChef.length });
  } catch (err) {
    console.error('SLA worker error:', err);
    res.status(500).json({ error: 'SLA check failed' });
  }
});

// ── GET /api/sla/admin/dashboard — admin SLA overview ─────────────────────────
router.get('/admin/dashboard', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const [slaBreaches, avgDelivery, disputeWindowExpiry, penaltyStats] = await Promise.all([
      sql`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE delivery_sla_breached = true) AS breached,
               ROUND(100.0 * COUNT(*) FILTER (WHERE delivery_sla_breached = true) / NULLIF(COUNT(*), 0), 2) AS breach_rate
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND status NOT IN ('pending_payment','payment_confirmed')
      `,
      sql`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at - accepted_at)) / 60), 0) AS avg_minutes
        FROM orders
        WHERE delivered_at IS NOT NULL AND accepted_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
      `,
      sql`
        SELECT COUNT(*) AS dispute_window_open
        FROM orders
        WHERE dispute_window_closes_at > NOW()
          AND status = 'delivered'
      `,
      sql`
        SELECT COUNT(*) AS total_penalties, COALESCE(SUM(score_deduction), 0) AS total_deductions
        FROM sla_penalties
        WHERE applied_at >= NOW() - INTERVAL '30 days'
      `,
    ]);

    const topBreachingCooks = await sql`
      SELECT cp.display_name, cp.username, COUNT(se.id) AS breach_count
      FROM sla_events se
      JOIN orders o ON o.id = se.entity_id AND se.entity_type = 'order'
      JOIN cook_profiles cp ON cp.id = o.cook_id
      WHERE se.event_type IN ('delivery_late','preparation_late')
        AND se.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY cp.id, cp.display_name, cp.username
      HAVING COUNT(se.id) >= 2
      ORDER BY breach_count DESC
      LIMIT 10
    `;

    res.json({
      sla_breaches:        slaBreaches[0],
      avg_delivery_minutes: parseFloat(avgDelivery[0]?.avg_minutes ?? 0),
      dispute_window:      disputeWindowExpiry[0],
      penalty_stats:       penaltyStats[0],
      top_breaching_cooks: topBreachingCooks,
    });
  } catch (err) {
    console.error('GET /sla/admin/dashboard:', err);
    res.status(500).json({ error: 'Failed to fetch SLA dashboard' });
  }
});

// ── POST /api/sla/rider/delivery — record rider delivery event ─────────────────
router.post('/rider/delivery', authenticate, async (req, res) => {
  try {
    const {
      order_id, rider_name, rider_phone, rider_user_id,
      proof_url, latitude, longitude,
    } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id required' });

    const orders = await sql`SELECT * FROM orders WHERE id = ${order_id}`;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    const isOwner = cooks.some(c => c.id === order.cook_id) || req.user.role === 'admin';
    if (!isOwner) return res.status(403).json({ error: 'Cook or admin only' });

    const slaMinutes = order.delivery_sla_minutes ?? SLA_MINUTES.delivery;
    const promised = order.delivery_promised_at ? new Date(order.delivery_promised_at) : null;
    const now = new Date();
    const slaBreached = promised ? now > promised : false;
    const minutesLate = promised && slaBreached ? Math.round((now - promised) / 60000) : 0;

    const [delivery] = await sql`
      INSERT INTO rider_deliveries (
        order_id, rider_user_id, rider_name, rider_phone,
        delivered_at, delivery_proof_url,
        delivery_latitude, delivery_longitude,
        sla_promised_minutes, sla_breached, minutes_late, assigned_at
      ) VALUES (
        ${order_id}, ${rider_user_id ?? null}, ${rider_name ?? null}, ${rider_phone ?? null},
        NOW(), ${proof_url ?? null},
        ${latitude ?? null}, ${longitude ?? null},
        ${slaMinutes}, ${slaBreached}, ${minutesLate}, NOW()
      )
      ON CONFLICT (order_id) DO UPDATE SET
        delivered_at         = NOW(),
        delivery_proof_url   = EXCLUDED.delivery_proof_url,
        delivery_latitude    = EXCLUDED.delivery_latitude,
        delivery_longitude   = EXCLUDED.delivery_longitude,
        sla_breached         = EXCLUDED.sla_breached,
        minutes_late         = EXCLUDED.minutes_late
      RETURNING *
    `;

    res.status(201).json({ delivery });
  } catch (err) {
    console.error('POST /sla/rider/delivery:', err);
    res.status(500).json({ error: 'Failed to record rider delivery' });
  }
});

module.exports = router;
