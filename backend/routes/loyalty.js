const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const POINTS_TO_CURRENCY_RATE = 0.5; // 1 point = ₦0.50 (or local equivalent)

// ── GET /api/loyalty ─────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const balance = await sql`
      SELECT * FROM loyalty_points WHERE customer_id = ${req.user.id}
    `;
    const history = await sql`
      SELECT lt.*, mi.title AS item_title, cp.display_name AS cook_name
      FROM loyalty_transactions lt
      LEFT JOIN orders o ON o.id = lt.order_id
      LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
      LEFT JOIN cook_profiles cp ON cp.id = lt.cook_id
      WHERE lt.customer_id = ${req.user.id}
      ORDER BY lt.created_at DESC LIMIT 20
    `;

    res.json({
      balance: balance[0] ?? { balance: 0, lifetime_earned: 0 },
      history,
      currency_value: (balance[0]?.balance ?? 0) * POINTS_TO_CURRENCY_RATE,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch loyalty balance' });
  }
});

// ── POST /api/loyalty/redeem ─────────────────────────────────────────────────
router.post('/redeem', authenticate, async (req, res) => {
  try {
    const { points, order_id } = req.body;
    if (!points || points <= 0) return res.status(400).json({ error: 'Invalid points amount' });

    const balanceRows = await sql`SELECT balance FROM loyalty_points WHERE customer_id = ${req.user.id}`;
    const currentBalance = parseInt(balanceRows[0]?.balance ?? 0);

    if (points > currentBalance) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    await sql`
      UPDATE loyalty_points
      SET balance = balance - ${points}
      WHERE customer_id = ${req.user.id}
    `;

    await sql`
      INSERT INTO loyalty_transactions (customer_id, type, points, description, order_id)
      VALUES (${req.user.id}, 'redeemed', ${-points}, 'Points redeemed at checkout', ${order_id ?? null})
    `;

    const discount = points * POINTS_TO_CURRENCY_RATE;
    res.json({ redeemed_points: points, discount_amount: discount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to redeem points' });
  }
});

// ── POST /api/loyalty/donate ─────────────────────────────────────────────────
router.post('/donate', authenticate, async (req, res) => {
  try {
    const { points, cook_id } = req.body;
    if (!points || points <= 0 || !cook_id) {
      return res.status(400).json({ error: 'points and cook_id required' });
    }

    const balanceRows = await sql`SELECT balance FROM loyalty_points WHERE customer_id = ${req.user.id}`;
    if (parseInt(balanceRows[0]?.balance ?? 0) < points) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    await sql`
      UPDATE loyalty_points SET balance = balance - ${points} WHERE customer_id = ${req.user.id}
    `;
    await sql`
      INSERT INTO loyalty_transactions (customer_id, type, points, description, cook_id)
      VALUES (${req.user.id}, 'donated', ${-points}, 'Points donated to cook', ${cook_id})
    `;

    res.json({ donated_points: points });
  } catch (err) {
    res.status(500).json({ error: 'Failed to donate points' });
  }
});

module.exports = router;
