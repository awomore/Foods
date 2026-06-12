const express = require('express');
const router = express.Router();
const { sql } = require('../supabase/db');
const { authenticate } = require('../middleware/auth');

const VALID_ENTITY_TYPES = ['menu_item', 'post', 'story', 'course', 'customer_post'];

// ── POST /api/video-views — record a view or completion event ─────────────────
// Can be called without auth (anonymous views counted too)
router.post('/', async (req, res) => {
  try {
    const { entity_type, entity_id, watch_seconds, completed } = req.body;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id required' });
    }
    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      return res.status(400).json({ error: `entity_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}` });
    }

    // Extract user_id from optional auth token
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        userId = decoded.id ?? null;
      } catch { /* anonymous view */ }
    }

    const [view] = await sql`
      INSERT INTO video_views (entity_type, entity_id, user_id, watch_seconds, completed)
      VALUES (
        ${entity_type}, ${entity_id}, ${userId},
        ${watch_seconds ?? 0}, ${completed ?? false}
      )
      RETURNING id, entity_type, entity_id, completed
    `;

    // Increment counters on the source entity
    if (entity_type === 'menu_item') {
      if (completed) {
        await sql`
          UPDATE menu_items SET
            video_view_count       = video_view_count + 1,
            video_completion_count = video_completion_count + 1
          WHERE id = ${entity_id}
        `;
      } else {
        await sql`
          UPDATE menu_items SET video_view_count = video_view_count + 1 WHERE id = ${entity_id}
        `;
      }
    } else if (entity_type === 'post') {
      if (completed) {
        await sql`
          UPDATE cook_diary_posts SET
            video_view_count       = video_view_count + 1,
            video_completion_count = video_completion_count + 1
          WHERE id = ${entity_id}
        `;
      } else {
        await sql`
          UPDATE cook_diary_posts SET video_view_count = video_view_count + 1 WHERE id = ${entity_id}
        `;
      }
    }

    res.status(201).json({ view });
  } catch (err) {
    console.error('video view record:', err);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// ── GET /api/video-views/:entityType/:entityId — aggregated stats ─────────────
router.get('/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity_type' });
    }

    const stats = await sql`
      SELECT
        COUNT(*)                                      AS total_views,
        COUNT(*) FILTER (WHERE completed = true)      AS completions,
        ROUND(AVG(watch_seconds)::numeric, 1)         AS avg_watch_seconds,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE completed) / NULLIF(COUNT(*),0), 1
        )                                             AS completion_rate
      FROM video_views
      WHERE entity_type = ${entityType} AND entity_id = ${entityId}
    `;
    res.json({ stats: stats[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch video stats' });
  }
});

// ── GET /api/video-views/creator/top — cook sees top-performing videos ─────────
router.get('/creator/top', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.json({ items: [] });

    const { limit = 10 } = req.query;

    const items = await sql`
      SELECT
        mi.id, mi.name, mi.video_url, mi.video_thumbnail,
        mi.video_view_count, mi.video_completion_count
      FROM menu_items mi
      WHERE mi.cook_id = ${cooks[0].id}
        AND mi.video_url IS NOT NULL
      ORDER BY mi.video_view_count DESC
      LIMIT ${Math.min(+limit, 100)}
    `;
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch top videos' });
  }
});

module.exports = router;
