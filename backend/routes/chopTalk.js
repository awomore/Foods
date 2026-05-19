const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/chop-talk/cook/:cookId ─────────────────────────────────────────
router.get('/cook/:cookId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const posts = await sql`
      SELECT ctp.*,
        u.full_name AS author_name, u.avatar_url AS author_avatar,
        cp_cook.display_name AS cook_name,
        (SELECT COUNT(*) FROM chop_talk_replies r WHERE r.post_id = ctp.id) AS reply_count
      FROM chop_talk_posts ctp
      JOIN users u ON u.id = ctp.customer_id
      JOIN cook_profiles cp_cook ON cp_cook.id = ctp.cook_id
      WHERE ctp.cook_id = ${req.params.cookId}
      ORDER BY ctp.is_pinned DESC, ctp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    // Active poster count (last 30 days)
    const activity = await sql`
      SELECT COUNT(DISTINCT customer_id) AS active_posters
      FROM chop_talk_posts
      WHERE cook_id = ${req.params.cookId}
        AND created_at >= NOW() - INTERVAL '30 days'
    `;

    res.json({ posts, active_posters: parseInt(activity[0]?.active_posters ?? 0) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Chop Talk' });
  }
});

// ── POST /api/chop-talk/cook/:cookId ────────────────────────────────────────
// Requires 1+ delivered order from this cook
router.post('/cook/:cookId', authenticate, async (req, res) => {
  try {
    const { cookId } = req.params;
    const { body, photo_urls } = req.body;

    if (!body?.trim()) return res.status(400).json({ error: 'Post body required' });

    // Verify customer has ordered from this cook
    const orders = await sql`
      SELECT COUNT(*) AS cnt FROM orders
      WHERE customer_id = ${req.user.id} AND cook_id = ${cookId} AND status = 'delivered'
    `;
    const orderCount = parseInt(orders[0]?.cnt ?? 0);
    if (orderCount === 0) {
      return res.status(403).json({ error: 'You need at least one delivered order to post here' });
    }

    const isMilestone = [5, 10, 25, 50, 100].includes(orderCount);

    const post = await sql`
      INSERT INTO chop_talk_posts (cook_id, customer_id, body, photo_urls, order_count_with_cook, is_milestone)
      VALUES (${cookId}, ${req.user.id}, ${body}, ${photo_urls ?? []}::text[], ${orderCount}, ${isMilestone})
      RETURNING *
    `;

    res.status(201).json({ post: post[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post to Chop Talk' });
  }
});

// ── GET /api/chop-talk/:postId/replies ──────────────────────────────────────
router.get('/:postId/replies', async (req, res) => {
  try {
    const replies = await sql`
      SELECT ctr.*, u.full_name AS author_name, u.avatar_url AS author_avatar
      FROM chop_talk_replies ctr
      JOIN users u ON u.id = ctr.author_id
      WHERE ctr.post_id = ${req.params.postId}
      ORDER BY ctr.created_at ASC
    `;
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

// ── POST /api/chop-talk/:postId/reply ───────────────────────────────────────
// Requires following the cook
router.post('/:postId/reply', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const { body } = req.body;

    if (!body?.trim()) return res.status(400).json({ error: 'Reply body required' });

    const posts = await sql`SELECT cook_id FROM chop_talk_posts WHERE id = ${postId}`;
    if (!posts.length) return res.status(404).json({ error: 'Post not found' });
    const cookId = posts[0].cook_id;

    // Check if replying user is the cook themselves
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} AND id = ${cookId}`;
    const isCook = cooks.length > 0;

    if (!isCook) {
      const follows = await sql`
        SELECT id FROM follows WHERE customer_id = ${req.user.id} AND cook_id = ${cookId}
      `;
      if (!follows.length) {
        return res.status(403).json({ error: 'Follow this cook to reply' });
      }
    }

    const reply = await sql`
      INSERT INTO chop_talk_replies (post_id, author_id, body, is_cook_reply)
      VALUES (${postId}, ${req.user.id}, ${body}, ${isCook})
      RETURNING *
    `;

    res.status(201).json({ reply: reply[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

// ── PATCH /api/chop-talk/:postId/pin ────────────────────────────────────────
router.patch('/:postId/pin', authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const posts = await sql`SELECT cook_id FROM chop_talk_posts WHERE id = ${postId}`;
    if (!posts.length) return res.status(404).json({ error: 'Post not found' });

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} AND id = ${posts[0].cook_id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Forbidden' });

    // Max 3 pinned posts
    const pinnedCount = await sql`
      SELECT COUNT(*) AS cnt FROM chop_talk_posts
      WHERE cook_id = ${posts[0].cook_id} AND is_pinned = true AND id != ${postId}
    `;
    if (parseInt(pinnedCount[0]?.cnt ?? 0) >= 3) {
      return res.status(400).json({ error: 'Maximum 3 posts can be pinned' });
    }

    await sql`UPDATE chop_talk_posts SET is_pinned = true WHERE id = ${postId}`;
    res.json({ message: 'Post pinned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin post' });
  }
});

module.exports = router;
