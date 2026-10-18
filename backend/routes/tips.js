const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { PaymentError } = require('../payments/claims');
const { recordPaidTip } = require('../payments/tips');

// ── POST /api/tips ───────────────────────────────────────────────────────────
// Body: { cook_id, order_id?, amount, tx_ref, payment_method? } — the tip is
// recorded only once that payment is verified and spent (payments/tips.js).
router.post('/', authenticate, async (req, res) => {
  try {
    const { cook_id, order_id, amount, tx_ref, payment_method } = req.body;

    if (!cook_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'cook_id and positive amount are required' });
    }

    // Verify cook accepts tips
    const cooks = await sql`SELECT is_accepting_tips, currency_code FROM cook_profiles WHERE id = ${cook_id}`;
    if (!cooks.length) return res.status(404).json({ error: 'Cook not found' });
    if (!cooks[0].is_accepting_tips) {
      return res.status(400).json({ error: 'This cook is not currently accepting tips' });
    }

    const tip = await recordPaidTip(sql, {
      userId: req.user.id, cookId: cook_id, orderId: order_id, amount,
      currency: cooks[0].currency_code ?? 'NGN', txRef: tx_ref, paymentMethod: payment_method,
    });
    res.status(201).json({ tip });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
    console.error('POST /tips:', err);
    res.status(500).json({ error: 'Failed to send tip' });
  }
});

// ── PATCH /api/tips/:id/thank-you ───────────────────────────────────────────
router.patch('/:id/thank-you', authenticate, async (req, res) => {
  try {
    const { cook_thank_you_note } = req.body;
    if (!cook_thank_you_note) return res.status(400).json({ error: 'Note required' });

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const tips = await sql`SELECT cook_id FROM tips WHERE id = ${req.params.id}`;
    if (!tips.length || tips[0].cook_id !== cooks[0].id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await sql`
      UPDATE tips SET cook_thank_you_note = ${cook_thank_you_note} WHERE id = ${req.params.id} RETURNING *
    `;
    res.json({ tip: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update thank-you note' });
  }
});

// ── GET /api/tips/cook ───────────────────────────────────────────────────────
router.get('/cook', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const tips = await sql`
      SELECT t.*, u.full_name AS customer_name, u.avatar_url AS customer_avatar
      FROM tips t
      JOIN users u ON u.id = t.customer_id
      WHERE t.cook_id = ${cooks[0].id} AND t.payout_status NOT IN ('awaiting_payment', 'void')
      ORDER BY t.created_at DESC
      LIMIT 30
    `;
    const total = await sql`
      SELECT COALESCE(SUM(amount), 0) AS total FROM tips
      WHERE cook_id = ${cooks[0].id} AND payout_status NOT IN ('awaiting_payment', 'void')
    `;
    res.json({ tips, total_tips: parseFloat(total[0]?.total ?? 0) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tips' });
  }
});

module.exports = router;
