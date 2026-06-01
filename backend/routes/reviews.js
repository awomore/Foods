const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/reviews/cook/:cookId ───────────────────────────────────────────
router.get('/cook/:cookId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const reviews = await sql`
      SELECT r.*, u.full_name AS customer_name, u.avatar_url AS customer_avatar
      FROM reviews r
      JOIN users u ON u.id = r.customer_id
      WHERE r.cook_id = ${req.params.cookId} AND r.is_visible = true
      ORDER BY r.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const summary = await sql`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(rating)::numeric, 1) AS avg_rating,
        COUNT(*) FILTER (WHERE rating = 5) AS five_star,
        COUNT(*) FILTER (WHERE rating = 4) AS four_star,
        COUNT(*) FILTER (WHERE rating = 3) AS three_star,
        COUNT(*) FILTER (WHERE rating = 2) AS two_star,
        COUNT(*) FILTER (WHERE rating = 1) AS one_star
      FROM reviews WHERE cook_id = ${req.params.cookId} AND is_visible = true
    `;

    res.json({ reviews, summary: summary[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ── POST /api/reviews ───────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { order_id, rating, body, photos } = req.body;

    if (!order_id || !rating) {
      return res.status(400).json({ error: 'order_id and rating are required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1–5' });
    }

    // Verify order belongs to customer and is delivered
    const orders = await sql`
      SELECT * FROM orders
      WHERE id = ${order_id}
        AND customer_id = ${req.user.id}
        AND status = 'delivered'
    `;
    if (!orders.length) {
      return res.status(403).json({ error: 'Order not found or not yet delivered' });
    }
    const order = orders[0];

    const review = await sql`
      INSERT INTO reviews (order_id, customer_id, cook_id, rating, body, photos)
      VALUES (${order_id}, ${req.user.id}, ${order.cook_id}, ${rating}, ${body ?? null}, ${photos ?? []}::text[])
      RETURNING *
    `;

    // Update cook average rating
    await sql`
      UPDATE cook_profiles
      SET average_rating = (
        SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE cook_id = ${order.cook_id} AND is_visible = true
      )
      WHERE id = ${order.cook_id}
    `;

    res.status(201).json({ review: review[0] });
  } catch (err) {
    console.error('POST /reviews:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Review already submitted for this order' });
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ── PATCH /api/reviews/:id/reply ────────────────────────────────────────────
router.patch('/:id/reply', authenticate, async (req, res) => {
  try {
    const { cook_reply } = req.body;
    if (!cook_reply) return res.status(400).json({ error: 'Reply text required' });

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const reviews = await sql`SELECT cook_id FROM reviews WHERE id = ${req.params.id}`;
    if (!reviews.length || reviews[0].cook_id !== cooks[0].id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await sql`
      UPDATE reviews
      SET cook_reply = ${cook_reply}, cook_replied_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ review: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit reply' });
  }
});

// ── POST /api/reviews/:id/report ─────────────────────────────────────────────
router.post('/:id/report', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'reason required' });

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const reviews = await sql`SELECT cook_id FROM reviews WHERE id = ${req.params.id}`;
    if (!reviews.length || reviews[0].cook_id !== cooks[0].id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await sql`
      UPDATE reviews
      SET reported = true, report_reason = ${reason}
      WHERE id = ${req.params.id}
    `;
    res.json({ message: 'Review reported' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to report review' });
  }
});

// ── GET /api/reviews/mine ────────────────────────────────────────────────────
// Cook sees all reviews they've received, with full analytics
router.get('/mine', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const { limit = 30, offset = 0, rating } = req.query;

    const reviews = await sql`
      SELECT r.*, u.full_name AS customer_name, u.avatar_url AS customer_avatar,
             o.menu_item_id,
             mi.title AS dish_title
      FROM reviews r
      JOIN users u ON u.id = r.customer_id
      LEFT JOIN orders o ON o.id = r.order_id
      LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
      WHERE r.cook_id = ${cookId}
        AND r.is_visible = true
        AND (${rating ?? null}::int IS NULL OR r.rating = ${rating ?? null}::int)
      ORDER BY r.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const analytics = await sql`
      SELECT
        COUNT(*) AS total_reviews,
        ROUND(AVG(rating)::numeric, 2) AS avg_rating,
        COUNT(*) FILTER (WHERE rating = 5) AS five_star,
        COUNT(*) FILTER (WHERE rating = 4) AS four_star,
        COUNT(*) FILTER (WHERE rating = 3) AS three_star,
        COUNT(*) FILTER (WHERE rating = 2) AS two_star,
        COUNT(*) FILTER (WHERE rating = 1) AS one_star,
        COUNT(*) FILTER (WHERE cook_reply IS NOT NULL) AS replied_count,
        COUNT(*) FILTER (WHERE reported = true) AS reported_count
      FROM reviews WHERE cook_id = ${cookId} AND is_visible = true
    `;

    res.json({ reviews, analytics: analytics[0] });
  } catch (err) {
    console.error('GET /reviews/mine:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
