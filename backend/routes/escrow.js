const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── POST /api/escrow/hold — create or update escrow hold after payment ───────
router.post('/hold', authenticate, async (req, res) => {
  try {
    const { order_id, flw_tx_ref } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id required' });

    const orders = await sql`
      SELECT id, total_amount FROM orders
      WHERE id = ${order_id} AND customer_id = ${req.user.id}
    `;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const [hold] = await sql`
      INSERT INTO escrow_holds (order_id, amount, flw_tx_ref)
      VALUES (${order_id}, ${orders[0].total_amount}, ${flw_tx_ref ?? null})
      ON CONFLICT (order_id) DO UPDATE SET
        flw_tx_ref = EXCLUDED.flw_tx_ref,
        status = 'held',
        payout_blocked = false
      RETURNING *
    `;
    res.status(201).json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create escrow hold' });
  }
});

// ── POST /api/escrow/:orderId/release — cook requests release after delivery ──
router.post('/:orderId/release', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const orders = await sql`
      SELECT id, status, has_dispute FROM orders
      WHERE id = ${req.params.orderId} AND cook_id = ${cooks[0].id}
    `;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    if (orders[0].has_dispute) return res.status(409).json({ error: 'Order has an open dispute — release blocked' });
    if (orders[0].status !== 'completed' && orders[0].status !== 'delivered') {
      return res.status(400).json({ error: 'Order must be delivered or completed before release' });
    }

    const [hold] = await sql`
      UPDATE escrow_holds SET status = 'released', released_at = NOW()
      WHERE order_id = ${req.params.orderId} AND status = 'held' AND payout_blocked = false
      RETURNING *
    `;
    if (!hold) return res.status(409).json({ error: 'Escrow hold not found or payout blocked' });

    await sql`UPDATE orders SET escrow_released = true WHERE id = ${req.params.orderId}`;

    res.json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to release escrow' });
  }
});

// ── GET /api/escrow/:orderId — get hold status ───────────────────────────────
router.get('/:orderId', authenticate, async (req, res) => {
  try {
    const holds = await sql`
      SELECT eh.*, o.cook_id, o.customer_id
      FROM escrow_holds eh JOIN orders o ON o.id = eh.order_id
      WHERE eh.order_id = ${req.params.orderId}
    `;
    if (!holds.length) return res.status(404).json({ error: 'Hold not found' });

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;
    const hold = holds[0];
    const isParty = hold.customer_id === req.user.id || hold.cook_id === cookId;
    if (!isParty && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    res.json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch escrow hold' });
  }
});

// ── POST /api/escrow/hold-chef — escrow for private chef booking ──────────────
router.post('/hold-chef', authenticate, async (req, res) => {
  try {
    const { booking_id, amount, flw_tx_ref } = req.body;
    if (!booking_id || !amount) return res.status(400).json({ error: 'booking_id and amount required' });

    const bookings = await sql`
      SELECT id FROM private_chef_bookings
      WHERE id = ${booking_id} AND customer_id = ${req.user.id}
    `;
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found' });

    // Auto-release: 30 days after booking (conservative for private chef)
    const autoRelease = new Date(Date.now() + 30 * 86400000).toISOString();

    const [hold] = await sql`
      INSERT INTO escrow_holds (amount, flw_tx_ref, escrow_type, source_id, auto_release_at)
      VALUES (${amount}, ${flw_tx_ref ?? null}, 'private_chef', ${booking_id}, ${autoRelease})
      RETURNING *
    `;
    res.status(201).json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create chef escrow hold' });
  }
});

// ── POST /api/escrow/hold-custom — escrow for custom order ───────────────────
router.post('/hold-custom', authenticate, async (req, res) => {
  try {
    const { request_id, amount, flw_tx_ref } = req.body;
    if (!request_id || !amount) return res.status(400).json({ error: 'request_id and amount required' });

    const reqs = await sql`
      SELECT id FROM custom_requests
      WHERE id = ${request_id} AND customer_id = ${req.user.id} AND status = 'accepted'
    `;
    if (!reqs.length) return res.status(404).json({ error: 'Custom request not found or not accepted' });

    // Auto-release: 7 days after delivery expected
    const autoRelease = new Date(Date.now() + 7 * 86400000).toISOString();

    const [hold] = await sql`
      INSERT INTO escrow_holds (amount, flw_tx_ref, escrow_type, source_id, auto_release_at)
      VALUES (${amount}, ${flw_tx_ref ?? null}, 'custom_order', ${request_id}, ${autoRelease})
      RETURNING *
    `;

    // Link hold back to the custom request
    await sql`
      UPDATE custom_requests SET escrow_hold_id = ${hold.id}
      WHERE id = ${request_id}
    `;

    res.status(201).json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create custom order escrow hold' });
  }
});

// ── POST /api/escrow/hold-course — escrow for course purchase ────────────────
router.post('/hold-course', authenticate, async (req, res) => {
  try {
    const { course_id, amount, flw_tx_ref } = req.body;
    if (!course_id || !amount) return res.status(400).json({ error: 'course_id and amount required' });

    const courses = await sql`SELECT id FROM courses WHERE id = ${course_id}`;
    if (!courses.length) return res.status(404).json({ error: 'Course not found' });

    // Auto-release: 7-day verification window for courses
    const autoRelease = new Date(Date.now() + 7 * 86400000).toISOString();

    const [hold] = await sql`
      INSERT INTO escrow_holds (amount, flw_tx_ref, escrow_type, source_id, auto_release_at)
      VALUES (${amount}, ${flw_tx_ref ?? null}, 'course', ${course_id}, ${autoRelease})
      RETURNING *
    `;
    res.status(201).json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create course escrow hold' });
  }
});

// ── POST /api/escrow/auto-release — worker endpoint: release timed-out holds ──
// Called by a cron worker; secured by internal secret
router.post('/auto-release', async (req, res) => {
  const secret = req.headers['x-worker-secret'];
  if (secret !== process.env.WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const released = await sql`
      UPDATE escrow_holds
      SET status = 'released', released_at = NOW()
      WHERE status = 'held'
        AND payout_blocked = false
        AND auto_release_at IS NOT NULL
        AND auto_release_at <= NOW()
      RETURNING id, order_id, source_id, escrow_type, amount
    `;

    // For food orders: mark escrow_released on the order
    for (const hold of released) {
      if (hold.escrow_type === 'food_order' && hold.order_id) {
        await sql`
          UPDATE orders SET escrow_released = true WHERE id = ${hold.order_id}
        `;
      }
    }

    res.json({ released: released.length, holds: released });
  } catch (err) {
    console.error('auto-release error:', err);
    res.status(500).json({ error: 'Auto-release failed' });
  }
});

// ── PATCH /api/escrow/:holdId/block — admin blocks a payout ─────────────────
router.patch('/:holdId/block', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const [hold] = await sql`
      UPDATE escrow_holds SET payout_blocked = true
      WHERE id = ${req.params.holdId}
      RETURNING *
    `;
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    res.json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block payout' });
  }
});

// ── PATCH /api/escrow/:holdId/unblock — admin unblocks a payout ─────────────
router.patch('/:holdId/unblock', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const [hold] = await sql`
      UPDATE escrow_holds SET payout_blocked = false
      WHERE id = ${req.params.holdId}
      RETURNING *
    `;
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    res.json({ hold });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock payout' });
  }
});

module.exports = router;
