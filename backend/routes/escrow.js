const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const ledger = require('../payments/ledger');
const crypto = require('crypto');

/**
 * Mirror an escrow release into the double-entry ledger (Phase 3 slice 3b).
 * At capture (slice 3a) the cook's cook_payout was credited to a per-cook
 * `escrow` account; releasing it moves that held amount into the cook's
 * `earnings` account, from which payouts are later drawn (slice 3c):
 *   debit  cook escrow    cook_payout
 *   credit cook earnings  cook_payout
 * Parallel mirror: nothing derives balances from the ledger yet, so a posting
 * failure must NOT block the domain release. Runs in its own transaction (legs
 * atomic); the per-order `ref` makes it idempotent for a future backfill. Only
 * food orders carry a cook escrow leg, so callers pass a food order_id.
 */
async function postEscrowRelease(orderId) {
  const rows = await sql`
    SELECT cook_id, cook_payout_minor, currency_code FROM orders WHERE id = ${orderId}
  `;
  const order = rows[0];
  if (!order) return;
  const payout = Number(order.cook_payout_minor ?? 0);
  if (payout <= 0) return;

  const currency = order.currency_code ?? 'NGN';
  await sql.begin(async sql => {
    const escrow   = await ledger.ensureAccount(sql, { ownerType: 'cook', ownerId: order.cook_id, accountType: 'escrow',   currency });
    const earnings = await ledger.ensureAccount(sql, { ownerType: 'cook', ownerId: order.cook_id, accountType: 'earnings', currency });
    await ledger.post(sql, {
      transactionId: crypto.randomUUID(),
      currency,
      entryType: 'escrow_release',
      description: 'Escrow released to cook earnings',
      ref: `escrow-release:${orderId}`,
      legs: [
        { accountId: escrow,   direction: 'debit',  amount_minor: payout },
        { accountId: earnings, direction: 'credit', amount_minor: payout },
      ],
    });
  });
}

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

    // Verify order exists and belongs to this cook
    const orderCheck = await sql`
      SELECT id, status FROM orders
      WHERE id = ${req.params.orderId} AND cook_id = ${cooks[0].id}
    `;
    if (!orderCheck.length) return res.status(404).json({ error: 'Order not found' });
    if (orderCheck[0].status !== 'completed' && orderCheck[0].status !== 'delivered') {
      return res.status(400).json({ error: 'Order must be delivered or completed before release' });
    }

    // Atomic release: the NOT EXISTS sub-select is evaluated in the same statement as the UPDATE,
    // closing the race window where a dispute could be opened between our check and the write.
    const [hold] = await sql`
      UPDATE escrow_holds SET status = 'released', released_at = NOW()
      WHERE order_id = ${req.params.orderId}
        AND status = 'held'
        AND payout_blocked = false
        AND NOT EXISTS (
          SELECT 1 FROM orders WHERE id = ${req.params.orderId} AND has_dispute = true
        )
      RETURNING *
    `;
    if (!hold) {
      // Distinguish between "dispute opened" vs "already released / blocked"
      const disputed = await sql`SELECT has_dispute FROM orders WHERE id = ${req.params.orderId}`;
      if (disputed[0]?.has_dispute) {
        return res.status(409).json({ error: 'Order has an open dispute — release blocked' });
      }
      return res.status(409).json({ error: 'Escrow hold not found or payout blocked' });
    }

    await sql`UPDATE orders SET escrow_released = true WHERE id = ${req.params.orderId}`;

    // Mirror escrow -> earnings in the ledger (best-effort; never blocks release).
    await postEscrowRelease(req.params.orderId).catch(err => {
      console.error(`[Escrow] Ledger release failed for order ${req.params.orderId} (release stands):`, err.message);
    });

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
        AND (order_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM orders WHERE id = escrow_holds.order_id AND has_dispute = true
        ))
      RETURNING id, order_id, source_id, escrow_type, amount
    `;

    // For food orders: mark escrow_released on the order + mirror escrow -> earnings.
    for (const hold of released) {
      if (hold.escrow_type === 'food_order' && hold.order_id) {
        await sql`
          UPDATE orders SET escrow_released = true WHERE id = ${hold.order_id}
        `;
        await postEscrowRelease(hold.order_id).catch(err => {
          console.error(`[Escrow] Ledger auto-release failed for order ${hold.order_id} (release stands):`, err.message);
        });
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
