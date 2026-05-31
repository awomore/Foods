const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { sql } = require('../supabase/db');
const { emitBatch } = require('../services/analytics');

// More generous rate limit for event ingestion (mobile batches events)
const ingestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: 'Too many analytics events' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Resolve user_id from optional Bearer token. Never throws. */
function resolveUserId(req) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

/** Middleware: require valid JWT, attach req.user + req.cookId (cook profiles only). */
async function requireCook(req, res, next) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const users = await sql`SELECT id, role FROM users WHERE id = ${userId} AND is_active = true`;
    if (!users.length) return res.status(401).json({ error: 'User not found' });
    req.user = users[0];

    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${userId}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    req.cookId = cooks[0].id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── POST /api/analytics/events ────────────────────────────────────────────────
// Mobile client sends batches of up to 200 events.
// Authentication is optional — user_id is derived from token when present.
router.post('/events', ingestLimiter, async (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events array required' });
  }
  if (events.length > 200) {
    return res.status(400).json({ error: 'Max 200 events per batch' });
  }

  const serverUserId = resolveUserId(req);
  const received = await emitBatch(events, serverUserId);
  res.json({ received });
});

// ── GET /api/analytics/creator/overview ──────────────────────────────────────
// Top-level KPI card data for a creator dashboard.
router.get('/creator/overview', requireCook, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days ?? 30), 365);
    const since    = new Date(Date.now() -     days * 86400000).toISOString().split('T')[0];
    const prevFrom = new Date(Date.now() - 2 * days * 86400000).toISOString().split('T')[0];

    const [curr] = await sql`
      SELECT
        COALESCE(SUM(gross_revenue), 0)                                   AS revenue,
        COALESCE(SUM(orders_received), 0)                                 AS orders,
        COALESCE(SUM(new_customers), 0)                                   AS new_customers,
        COALESCE(SUM(repeat_customers), 0)                                AS repeat_customers,
        COALESCE(SUM(post_views + story_views), 0)                        AS content_reach,
        COALESCE(SUM(profile_views), 0)                                   AS profile_views,
        COALESCE(SUM(dish_views), 0)                                      AS dish_views,
        COALESCE(SUM(new_followers), 0)                                   AS new_followers,
        COALESCE(SUM(lost_followers), 0)                                  AS lost_followers,
        COALESCE(SUM(post_likes + post_comments + post_shares + post_bookmarks), 0) AS engagements
      FROM creator_daily_metrics
      WHERE cook_id = ${req.cookId} AND date >= ${since}
    `;

    const [prev] = await sql`
      SELECT
        COALESCE(SUM(gross_revenue), 0)              AS revenue,
        COALESCE(SUM(orders_received), 0)            AS orders,
        COALESCE(SUM(new_customers), 0)              AS new_customers,
        COALESCE(SUM(post_views + story_views), 0)   AS content_reach,
        COALESCE(SUM(profile_views), 0)              AS profile_views
      FROM creator_daily_metrics
      WHERE cook_id = ${req.cookId} AND date >= ${prevFrom} AND date < ${since}
    `;

    // Current follower count from latest snapshot
    const [snap] = await sql`
      SELECT follower_count FROM follower_snapshots
      WHERE cook_id = ${req.cookId}
      ORDER BY date DESC LIMIT 1
    `;

    function pctChange(a, b) {
      const curr = parseFloat(a ?? 0);
      const prev = parseFloat(b ?? 0);
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    }

    res.json({
      period_days: days,
      current: {
        revenue:          parseFloat(curr.revenue),
        orders:           parseInt(curr.orders),
        new_customers:    parseInt(curr.new_customers),
        repeat_customers: parseInt(curr.repeat_customers),
        content_reach:    parseInt(curr.content_reach),
        profile_views:    parseInt(curr.profile_views),
        dish_views:       parseInt(curr.dish_views),
        followers:        snap?.follower_count ?? 0,
        new_followers:    parseInt(curr.new_followers),
        lost_followers:   parseInt(curr.lost_followers),
        net_followers:    parseInt(curr.new_followers) - parseInt(curr.lost_followers),
        engagements:      parseInt(curr.engagements),
      },
      deltas: {
        revenue_pct:       pctChange(curr.revenue, prev.revenue),
        orders_pct:        pctChange(curr.orders, prev.orders),
        new_customers_pct: pctChange(curr.new_customers, prev.new_customers),
        content_reach_pct: pctChange(curr.content_reach, prev.content_reach),
        profile_views_pct: pctChange(curr.profile_views, prev.profile_views),
      },
    });
  } catch (err) {
    console.error('GET /analytics/creator/overview:', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// ── GET /api/analytics/creator/followers ─────────────────────────────────────
// Time-series data for follower growth chart.
router.get('/creator/followers', requireCook, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days ?? 30), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const snapshots = await sql`
      SELECT date, follower_count
      FROM follower_snapshots
      WHERE cook_id = ${req.cookId} AND date >= ${since}
      ORDER BY date ASC
    `;

    const changes = await sql`
      SELECT date, new_followers, lost_followers,
             (new_followers - lost_followers) AS net_change
      FROM creator_daily_metrics
      WHERE cook_id = ${req.cookId} AND date >= ${since}
      ORDER BY date ASC
    `;

    // All-time follower count from current follows table
    const [total] = await sql`
      SELECT COUNT(*) AS count FROM follows WHERE cook_id = ${req.cookId}
    `;

    res.json({
      current_followers: parseInt(total?.count ?? 0),
      snapshots,
      daily_changes: changes,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch follower data' });
  }
});

// ── GET /api/analytics/creator/content ───────────────────────────────────────
// Per-post performance. sort: views | likes | orders | revenue | comments
router.get('/creator/content', requireCook, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? 20), 100);
    const offset = parseInt(req.query.offset ?? 0);
    const sort   = req.query.sort ?? 'views';

    const posts = await sql`
      SELECT
        cdp.id, cdp.title, cdp.body, cdp.post_type, cdp.status,
        cdp.created_at, cdp.photo_urls,
        COALESCE(cm.view_count,        0) AS view_count,
        COALESCE(cm.unique_viewers,    0) AS unique_viewers,
        COALESCE(cm.like_count,        0) AS like_count,
        COALESCE(cm.comment_count,     0) AS comment_count,
        COALESCE(cm.share_count,       0) AS share_count,
        COALESCE(cm.bookmark_count,    0) AS bookmark_count,
        COALESCE(cm.order_click_count, 0) AS order_click_count,
        COALESCE(cm.orders_from_post,  0) AS orders_from_post,
        COALESCE(cm.revenue_from_post, 0) AS revenue_from_post
      FROM cook_diary_posts cdp
      LEFT JOIN content_metrics cm ON cm.post_id = cdp.id
      WHERE cdp.cook_id = ${req.cookId}
      ORDER BY
        CASE WHEN ${sort}::text = 'views'    THEN COALESCE(cm.view_count, 0)        END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'likes'    THEN COALESCE(cm.like_count, 0)        END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'orders'   THEN COALESCE(cm.orders_from_post, 0)  END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'revenue'  THEN COALESCE(cm.revenue_from_post, 0) END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'comments' THEN COALESCE(cm.comment_count, 0)     END DESC NULLS LAST,
        cdp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [totals] = await sql`
      SELECT
        COALESCE(SUM(view_count), 0)        AS total_views,
        COALESCE(SUM(like_count), 0)        AS total_likes,
        COALESCE(SUM(orders_from_post), 0)  AS total_orders,
        COALESCE(SUM(revenue_from_post), 0) AS total_revenue
      FROM content_metrics
      WHERE cook_id = ${req.cookId}
    `;

    res.json({ posts, totals });
  } catch (err) {
    console.error('GET /analytics/creator/content:', err);
    res.status(500).json({ error: 'Failed to fetch content metrics' });
  }
});

// ── GET /api/analytics/creator/dishes ────────────────────────────────────────
// Per-dish conversion funnel. sort: orders | views | revenue | conversion
router.get('/creator/dishes', requireCook, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? 20), 100);
    const offset = parseInt(req.query.offset ?? 0);
    const sort   = req.query.sort ?? 'orders';

    const dishes = await sql`
      SELECT
        mi.id, mi.title, mi.unit_price, mi.photos, mi.is_active,
        mi.total_slots, mi.slots_claimed,
        COALESCE(dm.view_count,         0) AS view_count,
        COALESCE(dm.unique_viewers,     0) AS unique_viewers,
        COALESCE(dm.like_count,         0) AS like_count,
        COALESCE(dm.craving_count,      0) AS craving_count,
        COALESCE(dm.cart_add_count,     0) AS cart_add_count,
        COALESCE(dm.order_count,        0) AS order_count,
        COALESCE(dm.total_revenue,      0) AS total_revenue,
        COALESCE(dm.repeat_order_count, 0) AS repeat_order_count,
        dm.view_to_cart_rate,
        dm.cart_to_order_rate,
        dm.slot_fill_rate,
        dm.avg_order_value
      FROM menu_items mi
      LEFT JOIN dish_metrics dm ON dm.item_id = mi.id
      WHERE mi.cook_id = ${req.cookId}
      ORDER BY
        CASE WHEN ${sort}::text = 'orders'     THEN COALESCE(dm.order_count, 0)   END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'views'      THEN COALESCE(dm.view_count, 0)    END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'revenue'    THEN COALESCE(dm.total_revenue, 0) END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'conversion' THEN dm.view_to_cart_rate          END DESC NULLS LAST,
        CASE WHEN ${sort}::text = 'cravings'   THEN COALESCE(dm.craving_count, 0) END DESC NULLS LAST,
        mi.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.json({ dishes });
  } catch (err) {
    console.error('GET /analytics/creator/dishes:', err);
    res.status(500).json({ error: 'Failed to fetch dish metrics' });
  }
});

// ── GET /api/analytics/creator/audience ──────────────────────────────────────
// Audience breakdown by dietary preference and order frequency.
router.get('/creator/audience', requireCook, async (req, res) => {
  try {
    const segments = await sql`
      SELECT segment_type, segment_value, customer_count, order_count, revenue
      FROM audience_segments
      WHERE cook_id = ${req.cookId}
      ORDER BY segment_type, customer_count DESC
    `;

    const grouped = {};
    for (const seg of segments) {
      if (!grouped[seg.segment_type]) grouped[seg.segment_type] = [];
      grouped[seg.segment_type].push({
        value:     seg.segment_value,
        customers: parseInt(seg.customer_count),
        orders:    parseInt(seg.order_count),
        revenue:   parseFloat(seg.revenue),
      });
    }

    const [cohortStats] = await sql`
      SELECT
        COUNT(*)::int                                    AS total_customers,
        COUNT(*) FILTER (WHERE is_repeat)::int           AS repeat_customers,
        COALESCE(SUM(total_spent), 0)                    AS total_revenue,
        COALESCE(AVG(order_count), 0)                    AS avg_orders_per_customer
      FROM customer_cohorts
      WHERE cook_id = ${req.cookId}
    `;

    res.json({
      total_customers:        cohortStats?.total_customers       ?? 0,
      repeat_customers:       cohortStats?.repeat_customers      ?? 0,
      repeat_rate:            cohortStats?.total_customers > 0
        ? Math.round((cohortStats.repeat_customers / cohortStats.total_customers) * 100)
        : 0,
      avg_orders_per_customer: parseFloat(cohortStats?.avg_orders_per_customer ?? 0).toFixed(1),
      segments: grouped,
    });
  } catch (err) {
    console.error('GET /analytics/creator/audience:', err);
    res.status(500).json({ error: 'Failed to fetch audience data' });
  }
});

// ── GET /api/analytics/creator/orders ────────────────────────────────────────
// Revenue time-series, cohort retention, top customers.
router.get('/creator/orders', requireCook, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days ?? 30), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const timeSeries = await sql`
      SELECT
        date,
        orders_received, orders_completed,
        gross_revenue, net_payout,
        new_customers, repeat_customers, avg_order_value
      FROM creator_daily_metrics
      WHERE cook_id = ${req.cookId} AND date >= ${since}
      ORDER BY date ASC
    `;

    const cohortSummary = await sql`
      SELECT
        cohort_month,
        COUNT(*)::int                                    AS total_customers,
        COUNT(*) FILTER (WHERE is_repeat)::int           AS repeat_customers,
        COALESCE(SUM(total_spent), 0)                    AS cohort_revenue
      FROM customer_cohorts
      WHERE cook_id = ${req.cookId}
      GROUP BY cohort_month
      ORDER BY cohort_month DESC
      LIMIT 12
    `;

    const topCustomers = await sql`
      SELECT
        u.full_name, u.avatar_url,
        cc.order_count, cc.total_spent, cc.last_order_at, cc.first_order_at, cc.is_repeat
      FROM customer_cohorts cc
      JOIN users u ON u.id = cc.customer_id
      WHERE cc.cook_id = ${req.cookId}
      ORDER BY cc.total_spent DESC
      LIMIT 10
    `;

    res.json({
      time_series:    timeSeries,
      cohort_summary: cohortSummary,
      top_customers:  topCustomers,
    });
  } catch (err) {
    console.error('GET /analytics/creator/orders:', err);
    res.status(500).json({ error: 'Failed to fetch order analytics' });
  }
});

// ── GET /api/analytics/creator/cravings ──────────────────────────────────────
// Craving intelligence: what customers want, fulfillment rates, post-conversion revenue.
router.get('/creator/cravings', requireCook, async (req, res) => {
  try {
    // Top open cravings directed at this cook or unassigned
    const topCravings = await sql`
      SELECT
        dish_title,
        COUNT(*)::int                             AS craving_count,
        COUNT(*) FILTER (WHERE is_fulfilled)::int AS fulfilled_count,
        MAX(dish_price)                           AS suggested_price,
        COUNT(DISTINCT user_id)::int              AS unique_cravings,
        MAX(created_at)                           AS latest_craving_at
      FROM cravings
      WHERE (cook_id = ${req.cookId} OR cook_id IS NULL)
        AND is_fulfilled = false
      GROUP BY dish_title
      ORDER BY craving_count DESC
      LIMIT 20
    `;

    const [fulfillStats] = await sql`
      SELECT
        COUNT(*)::int                             AS total,
        COUNT(*) FILTER (WHERE is_fulfilled)::int AS fulfilled
      FROM cravings
      WHERE cook_id = ${req.cookId}
    `;

    // Revenue from orders sourced from posts (post_conversion = craving → post → order)
    const [postConversion] = await sql`
      SELECT
        COALESCE(SUM(o.cook_payout), 0) AS revenue,
        COUNT(*)::int                   AS orders
      FROM orders o
      WHERE o.cook_id = ${req.cookId}
        AND o.source_post_id IS NOT NULL
        AND o.status NOT IN ('cancelled', 'refunded')
    `;

    res.json({
      top_cravings:             topCravings,
      total_cravings:           parseInt(fulfillStats?.total     ?? 0),
      fulfilled_cravings:       parseInt(fulfillStats?.fulfilled ?? 0),
      fulfillment_rate:         fulfillStats?.total > 0
        ? Math.round((fulfillStats.fulfilled / fulfillStats.total) * 100)
        : 0,
      post_conversion_revenue:  parseFloat(postConversion.revenue),
      post_conversion_orders:   parseInt(postConversion.orders),
    });
  } catch (err) {
    console.error('GET /analytics/creator/cravings:', err);
    res.status(500).json({ error: 'Failed to fetch craving intelligence' });
  }
});

module.exports = router;
