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
             u.avatar_url AS cook_avatar
      FROM cook_diary_posts cdp
      JOIN cook_profiles cp ON cp.id = cdp.cook_id
      JOIN users u ON u.id = cp.user_id
      WHERE cdp.cook_id IN (
        SELECT cook_id FROM follows WHERE customer_id = ${req.user.id}
      )
      ORDER BY cdp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feed' });
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
