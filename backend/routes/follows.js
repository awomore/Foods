const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const analytics = require('../services/analytics');
const { notifyAndPush } = require('../services/push');

// ── GET /api/follows ────────────────────────────────────────────────────────
// Get all cooks the authenticated customer follows
router.get('/', authenticate, async (req, res) => {
  try {
    const follows = await sql`
      SELECT f.*, cp.display_name, cp.username, cp.average_rating,
             cp.is_live, cp.location, cp.platform_follower_count,
             u.avatar_url AS cook_avatar
      FROM follows f
      JOIN cook_profiles cp ON cp.id = f.cook_id
      JOIN users u ON u.id = cp.user_id
      WHERE f.customer_id = ${req.user.id}
      ORDER BY f.created_at DESC
    `;
    res.json({ follows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch follows' });
  }
});

// ── POST /api/follows/:cookId ───────────────────────────────────────────────
router.post('/:cookId', authenticate, async (req, res) => {
  try {
    const { cookId } = req.params;
    const { notify_new_menu = true, notify_diary_post = true, notify_flash_sale = true, notify_surprise_drop = true } = req.body;

    const cooks = await sql`SELECT id FROM cook_profiles WHERE id = ${cookId}`;
    if (!cooks.length) return res.status(404).json({ error: 'Cook not found' });

    const follow = await sql`
      INSERT INTO follows (customer_id, cook_id, notify_new_menu, notify_diary_post, notify_flash_sale, notify_surprise_drop)
      VALUES (${req.user.id}, ${cookId}, ${notify_new_menu}, ${notify_diary_post}, ${notify_flash_sale}, ${notify_surprise_drop})
      ON CONFLICT (customer_id, cook_id) DO UPDATE
        SET notify_new_menu = ${notify_new_menu},
            notify_diary_post = ${notify_diary_post},
            notify_flash_sale = ${notify_flash_sale},
            notify_surprise_drop = ${notify_surprise_drop}
      RETURNING *
    `;

    // Only notify on new follows, not on pref updates
    if (follow[0].created_at && new Date(follow[0].created_at) > new Date(Date.now() - 5000)) {
      const [follower]  = await sql`SELECT full_name FROM users WHERE id = ${req.user.id}`;
      const [cookOwner] = await sql`SELECT user_id FROM cook_profiles WHERE id = ${cookId}`;
      if (cookOwner) {
        notifyAndPush(
          cookOwner.user_id,
          'new_follower',
          'New follower!',
          (follower?.full_name ?? 'Someone') + ' is now following your kitchen',
          { follower_id: req.user.id },
        ).catch(() => {});
      }
    }

    // Track new follows only (not notification pref updates)
    const isNewFollow = follow[0].created_at &&
      new Date(follow[0].created_at) > new Date(Date.now() - 5000);
    if (isNewFollow) {
      analytics.emitEvent({
        event_name: 'cook_followed',
        user_id:    req.user.id,
        cook_id:    cookId,
        properties: { notify_diary_post, notify_flash_sale, notify_new_menu, notify_surprise_drop },
      }).catch(() => {});
    }

    res.status(201).json({ follow: follow[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to follow cook' });
  }
});

// ── DELETE /api/follows/:cookId ─────────────────────────────────────────────
router.delete('/:cookId', authenticate, async (req, res) => {
  try {
    await sql`
      DELETE FROM follows WHERE customer_id = ${req.user.id} AND cook_id = ${req.params.cookId}
    `;
    analytics.emitEvent({
      event_name: 'cook_unfollowed',
      user_id:    req.user.id,
      cook_id:    req.params.cookId,
    }).catch(() => {});
    res.json({ message: 'Unfollowed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unfollow' });
  }
});

// ── GET /api/follows/:cookId/status ─────────────────────────────────────────
router.get('/:cookId/status', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM follows
      WHERE customer_id = ${req.user.id} AND cook_id = ${req.params.cookId}
    `;
    res.json({ is_following: rows.length > 0, follow: rows[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

module.exports = router;
