const express = require('express');
const router = express.Router();
const { sql } = require('../supabase/db');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/auth'); // same middleware, used optionally

// ── GET /api/customer-posts?cook_id=&limit=&offset= ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const { cook_id, user_id, limit = 20, offset = 0 } = req.query;
    const lim = Math.min(+limit, 50);
    const off = +offset;

    let posts;
    if (cook_id) {
      // Posts that tag this creator
      posts = await sql`
        SELECT
          cp.id, cp.body, cp.photo_urls, cp.video_url, cp.video_thumbnail,
          cp.tagged_cook_ids, cp.like_count, cp.comment_count, cp.repost_count,
          cp.created_at,
          u.full_name AS author_name, u.avatar_url AS author_avatar, u.id AS author_id,
          (SELECT COUNT(*) FROM customer_post_reposts r WHERE r.post_id = cp.id) AS repost_count_real
        FROM customer_posts cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.status = 'published'
          AND ${cook_id} = ANY(cp.tagged_cook_ids)
        ORDER BY cp.created_at DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    } else if (user_id) {
      posts = await sql`
        SELECT
          cp.id, cp.body, cp.photo_urls, cp.video_url, cp.video_thumbnail,
          cp.tagged_cook_ids, cp.like_count, cp.comment_count, cp.repost_count,
          cp.created_at,
          u.full_name AS author_name, u.avatar_url AS author_avatar, u.id AS author_id
        FROM customer_posts cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.status = 'published' AND cp.user_id = ${user_id}
        ORDER BY cp.created_at DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    } else {
      // Feed of all customer posts
      posts = await sql`
        SELECT
          cp.id, cp.body, cp.photo_urls, cp.video_url, cp.video_thumbnail,
          cp.tagged_cook_ids, cp.like_count, cp.comment_count, cp.repost_count,
          cp.created_at,
          u.full_name AS author_name, u.avatar_url AS author_avatar, u.id AS author_id
        FROM customer_posts cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.status = 'published'
        ORDER BY cp.created_at DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    res.json({ posts });
  } catch (err) {
    console.error('customer posts list error:', err);
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

// ── POST /api/customer-posts (auth) ──────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      body, photo_urls = [], video_url, video_thumbnail,
      tagged_cook_ids = [], mention_user_ids = [], order_id,
    } = req.body;

    if (!body?.trim() && !photo_urls.length && !video_url) {
      return res.status(400).json({ error: 'Post must have text, photos, or video' });
    }

    const rows = await sql`
      INSERT INTO customer_posts (
        user_id, body, photo_urls, video_url, video_thumbnail,
        tagged_cook_ids, mention_user_ids, order_id
      ) VALUES (
        ${req.user.id},
        ${body?.trim() ?? null},
        ${photo_urls},
        ${video_url ?? null},
        ${video_thumbnail ?? null},
        ${tagged_cook_ids},
        ${mention_user_ids},
        ${order_id ?? null}
      )
      RETURNING *
    `;

    res.status(201).json({ post: rows[0] });
  } catch (err) {
    console.error('create customer post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ── DELETE /api/customer-posts/:id (auth, own post) ──────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const rows = await sql`
      UPDATE customer_posts
      SET status = 'removed'
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING id
    `;
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove post' });
  }
});

// ── POST /api/customer-posts/:id/like (auth) ─────────────────────────────────
router.post('/:id/like', auth, async (req, res) => {
  try {
    await sql`
      INSERT INTO customer_post_likes (user_id, post_id)
      VALUES (${req.user.id}, ${req.params.id})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      UPDATE customer_posts
      SET like_count = (
        SELECT COUNT(*) FROM customer_post_likes WHERE post_id = ${req.params.id}
      )
      WHERE id = ${req.params.id}
    `;
    res.json({ liked: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// ── DELETE /api/customer-posts/:id/like (auth) ───────────────────────────────
router.delete('/:id/like', auth, async (req, res) => {
  try {
    await sql`
      DELETE FROM customer_post_likes
      WHERE user_id = ${req.user.id} AND post_id = ${req.params.id}
    `;
    await sql`
      UPDATE customer_posts
      SET like_count = (
        SELECT COUNT(*) FROM customer_post_likes WHERE post_id = ${req.params.id}
      )
      WHERE id = ${req.params.id}
    `;
    res.json({ liked: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// ── POST /api/customer-posts/:id/repost (auth, cook only) ────────────────────
router.post('/:id/repost', auth, async (req, res) => {
  try {
    // Get the cook profile for this user
    const cookRows = await sql`
      SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}
    `;
    if (!cookRows.length) return res.status(403).json({ error: 'Only creators can repost' });

    await sql`
      INSERT INTO customer_post_reposts (post_id, cook_id)
      VALUES (${req.params.id}, ${cookRows[0].id})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      UPDATE customer_posts
      SET repost_count = (
        SELECT COUNT(*) FROM customer_post_reposts WHERE post_id = ${req.params.id}
      )
      WHERE id = ${req.params.id}
    `;
    res.json({ reposted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to repost' });
  }
});

module.exports = router;
