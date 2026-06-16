const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const analytics = require('../services/analytics');
const { notifyAndPush } = require('../services/push');

// ── GET /api/follows ────────────────────────────────────────────────────────
// Get all cooks the authenticated customer follows, with full cook card data
router.get('/', authenticate, async (req, res) => {
  try {
    const follows = await sql`
      SELECT
        f.cook_id, f.created_at AS followed_at,
        f.notify_new_menu, f.notify_diary_post, f.notify_flash_sale, f.notify_surprise_drop,
        cp.id, cp.user_id, cp.display_name, cp.username, cp.bio, cp.location,
        cp.admin_area, cp.latitude, cp.longitude,
        cp.average_rating, cp.repeat_order_rate, cp.total_orders,
        cp.platform_follower_count, cp.is_live, cp.is_health_kitchen,
        cp.food_safety_verified, cp.id_verified, cp.health_certified,
        cp.licensed_kitchen, cp.professional_chef, cp.trust_score,
        cp.storefront_title, cp.banner_image_url, cp.kitchen_photos,
        cp.currency_code, cp.creator_types, cp.verification_status,
        cp.accepts_private_chef, cp.accepts_catering, cp.profile_slug,
        u.full_name, u.avatar_url, u.country_code,
        COALESCE(
          (SELECT json_agg(json_build_object('id', mi.id, 'title', mi.title, 'unit_price', mi.unit_price, 'photos', mi.photos))
           FROM menu_items mi
           WHERE mi.cook_id = cp.id AND mi.is_today = true AND mi.is_active = true
           LIMIT 3),
          '[]'::json
        ) AS today_items
      FROM follows f
      JOIN cook_profiles cp ON cp.id = f.cook_id
      JOIN users u ON u.id = cp.user_id
      WHERE f.customer_id = ${req.user.id}
        AND cp.verification_status = 'approved'
      ORDER BY cp.is_live DESC, f.created_at DESC
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

// ── POST /api/follows/broadcast  (cook notifies followers — new-menu | flash-sale | segment) ─
router.post('/broadcast', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id, display_name FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cook = cooks[0];

    const { type, message, discount_pct, segment } = req.body;

    let followerRows;
    if (type === 'flash_sale') {
      followerRows = await sql`
        SELECT f.customer_id, u.push_token
        FROM follows f JOIN users u ON u.id = f.customer_id
        WHERE f.cook_id = ${cook.id} AND f.notify_flash_sale = true
          AND u.push_token IS NOT NULL AND u.push_token != ''
      `;
    } else if (type === 'new_menu') {
      followerRows = await sql`
        SELECT f.customer_id, u.push_token
        FROM follows f JOIN users u ON u.id = f.customer_id
        WHERE f.cook_id = ${cook.id} AND f.notify_new_menu = true
          AND u.push_token IS NOT NULL AND u.push_token != ''
      `;
    } else if (type === 'segment' && segment) {
      let extraWhere;
      if (segment === 'vip') {
        extraWhere = sql`
          AND (
            (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o
             WHERE o.customer_id = f.customer_id AND o.cook_id = ${cook.id}
               AND o.status IN ('delivered','completed')) >= 50000
            OR
            (SELECT COUNT(*) FROM orders o
             WHERE o.customer_id = f.customer_id AND o.cook_id = ${cook.id}
               AND o.status IN ('delivered','completed')) >= 10
          )
        `;
      } else if (segment === 'inactive') {
        extraWhere = sql`
          AND NOT EXISTS (
            SELECT 1 FROM orders o
            WHERE o.customer_id = f.customer_id AND o.cook_id = ${cook.id}
              AND o.status IN ('delivered','completed')
              AND o.created_at >= NOW() - INTERVAL '30 days'
          )
        `;
      } else if (segment === 'new') {
        extraWhere = sql`AND f.created_at >= NOW() - INTERVAL '14 days'`;
      } else {
        extraWhere = sql``;
      }
      followerRows = await sql`
        SELECT f.customer_id, u.push_token
        FROM follows f JOIN users u ON u.id = f.customer_id
        WHERE f.cook_id = ${cook.id}
          AND u.push_token IS NOT NULL AND u.push_token != ''
          ${extraWhere}
      `;
    } else {
      return res.status(400).json({ error: 'type required: new_menu | flash_sale | segment' });
    }

    if (!followerRows.length) return res.json({ sent: 0 });

    let title, body, notifType;
    if (type === 'new_menu') {
      title     = `${cook.display_name} has a new menu!`;
      body      = message ?? "Fresh dishes just added — come see what's cooking.";
      notifType = 'new_menu';
    } else if (type === 'flash_sale') {
      const pct = discount_pct ? `${discount_pct}% off` : 'special prices';
      title     = `⚡ Flash sale — ${cook.display_name}`;
      body      = message ?? `Limited time: ${pct} on selected dishes.`;
      notifType = 'flash_sale';
    } else {
      title     = `📣 ${cook.display_name}`;
      body      = message ?? 'You have a message from your favourite cook.';
      notifType = 'segment_broadcast';
    }

    const data = { cook_id: cook.id, type: notifType };
    const { sendPush } = require('../services/push');
    const tokens = followerRows.map(r => r.push_token).filter(Boolean);
    sendPush(tokens, { title, body, data }).catch(() => {});

    // In-app notifications (fire-and-forget)
    ;(async () => {
      for (const row of followerRows) {
        await sql`
          INSERT INTO notifications (user_id, type, title, body, data)
          VALUES (${row.customer_id}, ${notifType}, ${title}, ${body}, ${data}::jsonb)
        `.catch(() => {});
      }
    })();

    res.json({ sent: followerRows.length });
  } catch (err) {
    console.error('[broadcast]', err);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});

module.exports = router;
