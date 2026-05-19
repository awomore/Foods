const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/community ──────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;

    const posts = await sql`
      SELECT ccp.*, cp.display_name AS cook_name, cp.username AS cook_username,
             u.avatar_url AS cook_avatar,
             (SELECT COUNT(*) FROM cook_community_replies r WHERE r.post_id = ccp.id) AS reply_count
      FROM cook_community_posts ccp
      JOIN cook_profiles cp ON cp.id = ccp.cook_id
      JOIN users u ON u.id = cp.user_id
      WHERE (${category ?? null}::text IS NULL OR ccp.category = ${category ?? null})
      ORDER BY ccp.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch community posts' });
  }
});

// ── POST /api/community ─────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { category, body, photo_urls } = req.body;
    if (!category || !body) return res.status(400).json({ error: 'category and body required' });

    const post = await sql`
      INSERT INTO cook_community_posts (cook_id, category, body, photo_urls)
      VALUES (${cooks[0].id}, ${category}, ${body}, ${photo_urls ?? []}::text[])
      RETURNING *
    `;
    res.status(201).json({ post: post[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post' });
  }
});

// ── GET /api/community/:id/replies ──────────────────────────────────────────
router.get('/:id/replies', authenticate, async (req, res) => {
  try {
    const replies = await sql`
      SELECT ccr.*, cp.display_name AS cook_name, u.avatar_url AS cook_avatar
      FROM cook_community_replies ccr
      JOIN cook_profiles cp ON cp.id = ccr.cook_id
      JOIN users u ON u.id = cp.user_id
      WHERE ccr.post_id = ${req.params.id}
      ORDER BY ccr.created_at ASC
    `;
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

// ── POST /api/community/:id/reply ───────────────────────────────────────────
router.post('/:id/reply', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Reply body required' });

    const reply = await sql`
      INSERT INTO cook_community_replies (post_id, cook_id, body)
      VALUES (${req.params.id}, ${cooks[0].id}, ${body})
      RETURNING *
    `;
    res.status(201).json({ reply: reply[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post reply' });
  }
});

module.exports = router;
