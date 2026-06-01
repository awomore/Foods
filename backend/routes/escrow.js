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

module.exports = router;
