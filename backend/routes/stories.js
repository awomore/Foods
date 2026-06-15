const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── helpers ─────────────────────────────────────────────────────────────────

async function sendPushNotifications(tokens, payload) {
  if (!tokens.length) return;
  const messages = tokens.map(t => ({
    to: t,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.warn('Push send failed:', e.message);
  }
}

// ── GET /api/stories/feed ────────────────────────────────────────────────────
// Active stories from cooks the user follows, grouped by cook.
// Returns cooks ordered: LIVE first, then by most recent story.
router.get('/feed', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date().toISOString();

    // Active stories for followed cooks
    const rows = await sql`
      SELECT
        s.id, s.cook_id, s.type, s.media_url, s.media_type,
        s.caption, s.expires_at, s.created_at,
        cp.display_name, cp.username, cp.is_live,
        u.avatar_url AS cook_avatar,
        EXISTS(
          SELECT 1 FROM story_views sv
          WHERE sv.story_id = s.id AND sv.viewer_id = ${userId}
        ) AS has_viewed
      FROM stories s
      JOIN cook_profiles cp ON cp.id = s.cook_id
      JOIN users u ON u.id = cp.user_id
      JOIN follows f ON f.cook_id = s.cook_id AND f.customer_id = ${userId}
      WHERE s.is_active = true AND s.expires_at > ${now}
      ORDER BY cp.is_live DESC, s.created_at DESC
    `;

    // Group by cook
    const cookMap = new Map();
    for (const row of rows) {
      if (!cookMap.has(row.cook_id)) {
        cookMap.set(row.cook_id, {
          cook: {
            id: row.cook_id,
            display_name: row.display_name,
            username: row.username,
            avatar_url: row.cook_avatar,
            is_live: row.is_live,
          },
          stories: [],
          has_unseen: false,
        });
      }
      const entry = cookMap.get(row.cook_id);
      entry.stories.push({
        id: row.id,
        type: row.type,
        media_url: row.media_url,
        media_type: row.media_type,
        caption: row.caption,
        expires_at: row.expires_at,
        created_at: row.created_at,
        has_viewed: row.has_viewed,
      });
      if (!row.has_viewed) entry.has_unseen = true;
    }

    const feed = Array.from(cookMap.values());
    res.json({ feed });
  } catch (err) {
    console.error('GET /stories/feed:', err);
    res.status(500).json({ error: 'Failed to fetch stories feed' });
  }
});

// ── GET /api/stories/cook/:cookId ────────────────────────────────────────────
// Public: all active stories for a specific cook.
router.get('/cook/:cookId', async (req, res) => {
  try {
    const { cookId } = req.params;
    const now = new Date().toISOString();

    const stories = await sql`
      SELECT id, cook_id, type, media_url, media_type, caption,
             expires_at, view_count, created_at
      FROM stories
      WHERE cook_id = ${cookId}
        AND is_active = true
        AND expires_at > ${now}
      ORDER BY created_at ASC
    `;

    res.json({ stories });
  } catch (err) {
    console.error('GET /stories/cook/:cookId:', err);
    res.status(500).json({ error: 'Failed to fetch cook stories' });
  }
});

// ── POST /api/stories ────────────────────────────────────────────────────────
// Cook creates a story. type + optional media.
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const { type, media_url, media_type, caption } = req.body;
    if (!type) return res.status(400).json({ error: 'type required' });

    const [story] = await sql`
      INSERT INTO stories (cook_id, type, media_url, media_type, caption)
      VALUES (
        ${cookId}, ${type},
        ${media_url ?? null}, ${media_type ?? null},
        ${caption?.trim() ?? null}
      )
      RETURNING *
    `;

    // Notify followers for time-sensitive story types
    const notifyTypes = ['flash_sale', 'cooking_now'];
    if (notifyTypes.includes(type)) {
      const followers = await sql`
        SELECT f.customer_id, pt.token
        FROM follows f
        JOIN push_tokens pt ON pt.user_id = f.customer_id
        WHERE f.cook_id = ${cookId}
          AND f.notify_flash_sale = true
      `;
      if (followers.length > 0) {
        const [cookInfo] = await sql`SELECT display_name FROM cook_profiles WHERE id = ${cookId}`;
        const cookName = cookInfo?.display_name ?? 'A cook';
        const titles = { flash_sale: 'Flash Sale!', cooking_now: 'Cooking Now!' };
        const bodies = {
          flash_sale:   `${cookName} just posted a flash sale — grab it before it's gone`,
          cooking_now:  `${cookName} is cooking right now`,
        };
        for (const f of followers) {
          await sql`
            INSERT INTO notifications (user_id, type, title, body, data)
            VALUES (
              ${f.customer_id}, ${type},
              ${titles[type]},
              ${bodies[type]},
              ${{ cook_id: cookId, story_id: story.id }}::jsonb
            )
          `;
        }
        const tokens = followers.map(f => f.token).filter(Boolean);
        sendPushNotifications(tokens, {
          title: titles[type],
          body: bodies[type],
          data: { type, cook_id: cookId, story_id: story.id },
        });
      }
    }

    res.status(201).json({ story });
  } catch (err) {
    console.error('POST /stories:', err);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// ── DELETE /api/stories/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    await sql`
      UPDATE stories SET is_active = false
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
    `;
    res.json({ message: 'Story removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// ── POST /api/stories/:id/view ───────────────────────────────────────────────
// ── POST /api/stories/:id/react ─────────────────────────────────────────────
router.post('/:id/react', authenticate, async (req, res) => {
  const { emoji = '❤️' } = req.body;
  const userId  = req.user.id;
  const storyId = req.params.id;
  try {
    await sql`
      INSERT INTO story_reactions (story_id, user_id, emoji)
      VALUES (${storyId}, ${userId}, ${emoji})
      ON CONFLICT (story_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji
    `;

    const [story] = await sql`
      SELECT s.cook_id, cp.user_id AS cook_user_id
      FROM stories s JOIN cook_profiles cp ON cp.id = s.cook_id
      WHERE s.id = ${storyId}
    `;
    if (story) {
      const [sender]  = await sql`SELECT full_name, username FROM users WHERE id = ${userId}`;
      const tokens    = await sql`SELECT token FROM push_tokens WHERE user_id = ${story.cook_user_id}`;
      const name      = sender?.username || sender?.full_name || 'Someone';
      await sendPushNotifications(tokens.map(t => t.token), {
        title: `${emoji} ${name}`,
        body:  'Reacted to your story',
        data:  { type: 'story_reaction', story_id: storyId },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('story react error:', err);
    res.status(500).json({ error: 'Failed to react' });
  }
});

// ── POST /api/stories/:id/reply ──────────────────────────────────────────────
router.post('/:id/reply', authenticate, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
  const userId  = req.user.id;
  const storyId = req.params.id;
  try {
    const [reply] = await sql`
      INSERT INTO story_replies (story_id, sender_id, message)
      VALUES (${storyId}, ${userId}, ${message.trim()})
      RETURNING *
    `;

    const [story] = await sql`
      SELECT s.cook_id, cp.user_id AS cook_user_id
      FROM stories s JOIN cook_profiles cp ON cp.id = s.cook_id
      WHERE s.id = ${storyId}
    `;
    if (story) {
      const [sender] = await sql`SELECT full_name, username FROM users WHERE id = ${userId}`;
      const tokens   = await sql`SELECT token FROM push_tokens WHERE user_id = ${story.cook_user_id}`;
      const name     = sender?.username || sender?.full_name || 'Someone';
      await sendPushNotifications(tokens.map(t => t.token), {
        title: `💬 ${name}`,
        body:  message.trim(),
        data:  { type: 'story_reply', story_id: storyId },
      });
    }
    res.json({ ok: true, reply });
  } catch (err) {
    console.error('story reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// ── POST /api/stories/:id/view ───────────────────────────────────────────────
router.post('/:id/view', authenticate, async (req, res) => {
  try {
    await sql`
      INSERT INTO story_views (story_id, viewer_id)
      VALUES (${req.params.id}, ${req.user.id})
      ON CONFLICT DO NOTHING
    `;
    await sql`
      UPDATE stories SET view_count = view_count + 1
      WHERE id = ${req.params.id}
        AND NOT EXISTS (
          SELECT 1 FROM story_views
          WHERE story_id = ${req.params.id} AND viewer_id = ${req.user.id}
        )
    `;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

module.exports = { router, sendPushNotifications };
