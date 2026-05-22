const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/diary/cook/:cookId ──────────────────────────────────────────────
router.get('/cook/:cookId', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const posts = await sql`
      SELECT * FROM cook_diary_posts
      WHERE cook_id = ${req.params.cookId}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch diary' });
  }
});

// ── GET /api/diary/feed ─────────────────────────────────────────────────────
// Diary posts from followed cooks
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;

    const posts = await sql`
      SELECT cdp.*, cp.display_name AS cook_name, cp.username AS cook_username,
             u.avatar_url AS cook_avatar,
             (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
             EXISTS(SELECT 1 FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id AND user_id = ${req.user.id}) AS user_liked
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      JOIN users u ON u.id = cp.user_id
      WHERE cdp.cook_id IN (
        SELECT cook_id FROM follows WHERE customer_id = ${req.user.id}
      )
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    // Note: diary posts don't directly map to menu items, so craving counts appear at cook level
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// ── GET /api/diary/global ───────────────────────────────────────────────────
// Public feed — all recent diary posts (no auth required)
router.get('/global', async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const userId = req.headers.authorization ? (() => {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        return jwt.verify(token, process.env.JWT_SECRET).id;
      } catch { return null; }
    })() : null;

    const posts = await sql`
      SELECT cdp.*, cp.display_name AS cook_name, cp.username AS cook_username,
             u.avatar_url AS cook_avatar,
             (SELECT COUNT(*) FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id)::int AS like_count,
             ${userId ? sql`EXISTS(SELECT 1 FROM likes WHERE target_type = 'diary_post' AND target_id = cdp.id AND user_id = ${userId})` : sql`false`} AS user_liked
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      JOIN users u ON u.id = cp.user_id
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch global feed' });
  }
});

// ── POST /api/diary ─────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { body, photo_url, video_url } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Post body required' });

    const post = await sql`
      INSERT INTO cook_diary_posts (cook_id, body, photo_url, video_url)
      VALUES (${cooks[0].id}, ${body}, ${photo_url ?? null}, ${video_url ?? null})
      RETURNING *
    `;

    // Notify followers
    const followers = await sql`
      SELECT customer_id FROM follows
      WHERE cook_id = ${cooks[0].id} AND notify_diary_post = true
    `;

    if (followers.length > 0) {
      const cookInfo = await sql`SELECT display_name FROM cook_profiles WHERE id = ${cooks[0].id}`;
      const cookName = cookInfo[0]?.display_name ?? 'Your cook';
      for (const f of followers) {
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (${f.customer_id}, 'diary_post', ${cookName + ' posted a diary update'},
                  ${body.slice(0, 100)},
                  ${{ cook_id: cooks[0].id, post_id: post[0].id }}::jsonb)
        `;
      }
    }

    res.status(201).json({ post: post[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post diary entry' });
  }
});

// ── POST /api/diary/:id/like  (toggle) ──────────────────────────────────────
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const existing = await sql`
      SELECT id FROM likes WHERE user_id = ${req.user.id} AND target_type = 'diary_post' AND target_id = ${req.params.id}
    `;
    if (existing.length) {
      await sql`DELETE FROM likes WHERE user_id = ${req.user.id} AND target_type = 'diary_post' AND target_id = ${req.params.id}`;
    } else {
      await sql`INSERT INTO likes (user_id, target_type, target_id) VALUES (${req.user.id}, 'diary_post', ${req.params.id}) ON CONFLICT DO NOTHING`;
    }
    const [{ count }] = await sql`SELECT COUNT(*) AS count FROM likes WHERE target_type = 'diary_post' AND target_id = ${req.params.id}`;
    res.json({ liked: !existing.length, like_count: Number(count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ── GET /api/diary/feed (with like state) ───────────────────────────────────
// (already defined above, but we need like_count + user_liked enrichment)
// This patch adds a second /feed-v2 or we update the existing one below.
// We update the existing /feed handler:

// ── DELETE /api/diary/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Forbidden' });

    await sql`
      DELETE FROM cook_diary_posts
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
    `;
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

module.exports = router;
