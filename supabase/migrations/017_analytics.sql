-- Migration 017: Creator Analytics Foundation
-- Raw event log, daily aggregates, content/dish metrics, follower snapshots,
-- audience segments, customer cohorts, and aggregation stored procedures.

-- ── Raw Event Log ─────────────────────────────────────────────────────────────
-- Append-only log of every trackable user action. Never update rows.
-- FK references use SET NULL so deleting content never loses event history.
CREATE TABLE IF NOT EXISTS analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  event_name  TEXT NOT NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id  TEXT,
  -- Entity context (which cook/item/post/order/story the event is about)
  cook_id     UUID REFERENCES cook_profiles(id) ON DELETE SET NULL,
  item_id     UUID REFERENCES menu_items(id)    ON DELETE SET NULL,
  post_id     UUID REFERENCES cook_diary_posts(id) ON DELETE SET NULL,
  order_id    UUID REFERENCES orders(id)        ON DELETE SET NULL,
  story_id    UUID REFERENCES stories(id)       ON DELETE SET NULL,
  properties  JSONB NOT NULL DEFAULT '{}',
  platform    TEXT CHECK (platform IN ('ios', 'android', 'web', 'server')),
  app_version TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Targeted indexes for the six most common query shapes:
-- 1. User event stream (user activity timeline)
CREATE INDEX IF NOT EXISTS ae_user_time_idx     ON analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
-- 2. Creator analytics (all events for a cook in a time window)
CREATE INDEX IF NOT EXISTS ae_cook_event_idx    ON analytics_events (cook_id, event_name, created_at DESC) WHERE cook_id IS NOT NULL;
-- 3. Platform funnel queries (all events of a type across all users)
CREATE INDEX IF NOT EXISTS ae_event_time_idx    ON analytics_events (event_name, created_at DESC);
-- 4. Dish performance
CREATE INDEX IF NOT EXISTS ae_item_time_idx     ON analytics_events (item_id, created_at DESC) WHERE item_id IS NOT NULL;
-- 5. Content performance
CREATE INDEX IF NOT EXISTS ae_post_time_idx     ON analytics_events (post_id, created_at DESC) WHERE post_id IS NOT NULL;
-- 6. Session replay / dedup
CREATE INDEX IF NOT EXISTS ae_session_idx       ON analytics_events (session_id) WHERE session_id IS NOT NULL;
-- 7. Time-range partition scans
CREATE INDEX IF NOT EXISTS ae_created_brin      ON analytics_events USING brin (created_at);
-- 8. Order-linked events
CREATE INDEX IF NOT EXISTS ae_order_idx         ON analytics_events (order_id) WHERE order_id IS NOT NULL;


-- ── Creator Daily Metrics ──────────────────────────────────────────────────────
-- Pre-aggregated daily snapshot per cook. Written by the nightly scheduler.
-- Never updated manually — only by aggregate_creator_daily().
CREATE TABLE IF NOT EXISTS creator_daily_metrics (
  id                  BIGSERIAL PRIMARY KEY,
  cook_id             UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  -- Follower dynamics
  follower_count      INT NOT NULL DEFAULT 0,   -- snapshot at end of day
  new_followers       INT NOT NULL DEFAULT 0,
  lost_followers      INT NOT NULL DEFAULT 0,
  -- Content reach
  post_views          INT NOT NULL DEFAULT 0,
  story_views         INT NOT NULL DEFAULT 0,
  post_likes          INT NOT NULL DEFAULT 0,
  post_comments       INT NOT NULL DEFAULT 0,
  post_shares         INT NOT NULL DEFAULT 0,
  post_bookmarks      INT NOT NULL DEFAULT 0,
  posts_published     INT NOT NULL DEFAULT 0,
  stories_published   INT NOT NULL DEFAULT 0,
  -- Order & revenue
  orders_received     INT NOT NULL DEFAULT 0,
  orders_completed    INT NOT NULL DEFAULT 0,
  gross_revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_payout          NUMERIC(12,2) NOT NULL DEFAULT 0,
  new_customers       INT NOT NULL DEFAULT 0,
  repeat_customers    INT NOT NULL DEFAULT 0,
  avg_order_value     NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Discovery & intent
  profile_views       INT NOT NULL DEFAULT 0,
  dish_views          INT NOT NULL DEFAULT 0,
  cravings_received   INT NOT NULL DEFAULT 0,
  cravings_fulfilled  INT NOT NULL DEFAULT 0,
  UNIQUE (cook_id, date)
);

CREATE INDEX IF NOT EXISTS cdm_cook_date_idx ON creator_daily_metrics (cook_id, date DESC);


-- ── Content Metrics ────────────────────────────────────────────────────────────
-- Per-post performance. Updated nightly from analytics_events + orders.
CREATE TABLE IF NOT EXISTS content_metrics (
  post_id             UUID PRIMARY KEY REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  cook_id             UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  view_count          INT NOT NULL DEFAULT 0,
  unique_viewers      INT NOT NULL DEFAULT 0,
  like_count          INT NOT NULL DEFAULT 0,
  comment_count       INT NOT NULL DEFAULT 0,
  share_count         INT NOT NULL DEFAULT 0,
  bookmark_count      INT NOT NULL DEFAULT 0,
  order_click_count   INT NOT NULL DEFAULT 0,  -- "Order This" CTA taps
  orders_from_post    INT NOT NULL DEFAULT 0,  -- orders with source_post_id = this post
  revenue_from_post   NUMERIC(12,2) NOT NULL DEFAULT 0,
  first_seen_at       TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cm_cook_idx      ON content_metrics (cook_id);
CREATE INDEX IF NOT EXISTS cm_orders_idx    ON content_metrics (cook_id, orders_from_post DESC);


-- ── Dish Metrics ───────────────────────────────────────────────────────────────
-- Per-dish conversion funnel. Updated nightly.
CREATE TABLE IF NOT EXISTS dish_metrics (
  item_id             UUID PRIMARY KEY REFERENCES menu_items(id) ON DELETE CASCADE,
  cook_id             UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  view_count          INT NOT NULL DEFAULT 0,
  unique_viewers      INT NOT NULL DEFAULT 0,
  like_count          INT NOT NULL DEFAULT 0,
  craving_count       INT NOT NULL DEFAULT 0,
  wishlist_count      INT NOT NULL DEFAULT 0,
  cart_add_count      INT NOT NULL DEFAULT 0,
  order_count         INT NOT NULL DEFAULT 0,
  slot_fill_rate      NUMERIC(5,2),              -- (slots_claimed / total_slots) * 100
  view_to_cart_rate   NUMERIC(8,6),              -- cart_add_count / view_count
  cart_to_order_rate  NUMERIC(8,6),              -- order_count / cart_add_count
  total_revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  avg_order_value     NUMERIC(10,2),
  repeat_order_count  INT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dm_cook_orders_idx ON dish_metrics (cook_id, order_count DESC);
CREATE INDEX IF NOT EXISTS dm_cook_views_idx  ON dish_metrics (cook_id, view_count DESC);


-- ── Follower Snapshots ──────────────────────────────────────────────────────────
-- Daily follower count history for time-series growth charts.
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id             BIGSERIAL PRIMARY KEY,
  cook_id        UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  follower_count INT NOT NULL DEFAULT 0,
  UNIQUE (cook_id, date)
);

CREATE INDEX IF NOT EXISTS fs_cook_date_idx ON follower_snapshots (cook_id, date DESC);


-- ── Audience Segments ──────────────────────────────────────────────────────────
-- Pre-computed audience breakdown per cook by dimension.
-- segment_type values: 'dietary', 'order_frequency', 'lga'
CREATE TABLE IF NOT EXISTS audience_segments (
  id              BIGSERIAL PRIMARY KEY,
  cook_id         UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  segment_type    TEXT NOT NULL,
  segment_value   TEXT NOT NULL,
  customer_count  INT NOT NULL DEFAULT 0,
  order_count     INT NOT NULL DEFAULT 0,
  revenue         NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cook_id, segment_type, segment_value)
);

CREATE INDEX IF NOT EXISTS as_cook_type_idx ON audience_segments (cook_id, segment_type);


-- ── Customer Cohorts ───────────────────────────────────────────────────────────
-- Cook-customer relationship for repeat/retention analytics.
-- One row per (cook, customer) pair — upserted on every new order.
CREATE TABLE IF NOT EXISTS customer_cohorts (
  id               BIGSERIAL PRIMARY KEY,
  cook_id          UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  first_order_at   TIMESTAMPTZ NOT NULL,
  first_order_week DATE NOT NULL,         -- Monday of first-order week
  cohort_month     TEXT NOT NULL,         -- 'YYYY-MM' for cohort grouping
  order_count      INT NOT NULL DEFAULT 1,
  last_order_at    TIMESTAMPTZ NOT NULL,
  total_spent      NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_repeat        BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (cook_id, customer_id)
);

CREATE INDEX IF NOT EXISTS cc_cook_cohort_idx  ON customer_cohorts (cook_id, cohort_month);
CREATE INDEX IF NOT EXISTS cc_cook_repeat_idx  ON customer_cohorts (cook_id, is_repeat);
CREATE INDEX IF NOT EXISTS cc_cook_value_idx   ON customer_cohorts (cook_id, total_spent DESC);


-- ── Aggregation: Follower Snapshots ────────────────────────────────────────────
-- Called nightly to snapshot current follower counts.
CREATE OR REPLACE FUNCTION snapshot_follower_counts(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO follower_snapshots (cook_id, date, follower_count)
  SELECT
    cp.id,
    p_date,
    COUNT(f.customer_id)::int
  FROM cook_profiles cp
  LEFT JOIN follows f ON f.cook_id = cp.id
  GROUP BY cp.id
  ON CONFLICT (cook_id, date) DO UPDATE
    SET follower_count = EXCLUDED.follower_count;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ── Aggregation: Content Metrics ──────────────────────────────────────────────
-- Incrementally adds one day's event counts to content_metrics.
CREATE OR REPLACE FUNCTION aggregate_content_metrics(p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS void AS $$
BEGIN
  -- View counts from events
  INSERT INTO content_metrics (post_id, cook_id, view_count, unique_viewers, first_seen_at)
  SELECT
    ae.post_id,
    ae.cook_id,
    COUNT(*)::int,
    COUNT(DISTINCT ae.user_id)::int,
    MIN(ae.created_at)
  FROM analytics_events ae
  WHERE ae.event_name = 'post_viewed'
    AND ae.post_id IS NOT NULL
    AND ae.cook_id IS NOT NULL
    AND ae.created_at >= p_date
    AND ae.created_at <  p_date + 1
  GROUP BY ae.post_id, ae.cook_id
  ON CONFLICT (post_id) DO UPDATE SET
    view_count     = content_metrics.view_count     + EXCLUDED.view_count,
    unique_viewers = content_metrics.unique_viewers + EXCLUDED.unique_viewers,
    first_seen_at  = LEAST(content_metrics.first_seen_at, EXCLUDED.first_seen_at),
    updated_at     = NOW();

  -- Engagement counts (likes, comments, shares, bookmarks)
  INSERT INTO content_metrics (post_id, cook_id, like_count, comment_count, share_count, bookmark_count)
  SELECT
    ae.post_id,
    ae.cook_id,
    COUNT(*) FILTER (WHERE ae.event_name = 'post_liked')::int,
    COUNT(*) FILTER (WHERE ae.event_name = 'post_commented')::int,
    COUNT(*) FILTER (WHERE ae.event_name = 'post_shared')::int,
    COUNT(*) FILTER (WHERE ae.event_name = 'post_bookmarked')::int
  FROM analytics_events ae
  WHERE ae.event_name IN ('post_liked', 'post_commented', 'post_shared', 'post_bookmarked')
    AND ae.post_id IS NOT NULL
    AND ae.cook_id IS NOT NULL
    AND ae.created_at >= p_date
    AND ae.created_at <  p_date + 1
  GROUP BY ae.post_id, ae.cook_id
  ON CONFLICT (post_id) DO UPDATE SET
    like_count     = content_metrics.like_count     + EXCLUDED.like_count,
    comment_count  = content_metrics.comment_count  + EXCLUDED.comment_count,
    share_count    = content_metrics.share_count    + EXCLUDED.share_count,
    bookmark_count = content_metrics.bookmark_count + EXCLUDED.bookmark_count,
    updated_at     = NOW();

  -- Order CTA clicks
  INSERT INTO content_metrics (post_id, cook_id, order_click_count)
  SELECT ae.post_id, ae.cook_id, COUNT(*)::int
  FROM analytics_events ae
  WHERE ae.event_name = 'post_order_cta_tapped'
    AND ae.post_id IS NOT NULL
    AND ae.cook_id IS NOT NULL
    AND ae.created_at >= p_date
    AND ae.created_at <  p_date + 1
  GROUP BY ae.post_id, ae.cook_id
  ON CONFLICT (post_id) DO UPDATE SET
    order_click_count = content_metrics.order_click_count + EXCLUDED.order_click_count,
    updated_at        = NOW();

  -- Orders and revenue originating from posts
  UPDATE content_metrics cm
  SET
    orders_from_post  = cm.orders_from_post  + sub.cnt,
    revenue_from_post = cm.revenue_from_post + sub.rev,
    updated_at        = NOW()
  FROM (
    SELECT o.source_post_id AS post_id,
           COUNT(*)::int AS cnt,
           SUM(o.cook_payout) AS rev
    FROM orders o
    WHERE o.source_post_id IS NOT NULL
      AND o.created_at >= p_date
      AND o.created_at <  p_date + 1
      AND o.status NOT IN ('cancelled', 'refunded')
    GROUP BY o.source_post_id
  ) sub
  WHERE cm.post_id = sub.post_id;
END;
$$ LANGUAGE plpgsql;


-- ── Aggregation: Dish Metrics ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION aggregate_dish_metrics(p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS void AS $$
BEGIN
  -- View counts
  INSERT INTO dish_metrics (item_id, cook_id, view_count, unique_viewers)
  SELECT
    ae.item_id,
    ae.cook_id,
    COUNT(*)::int,
    COUNT(DISTINCT ae.user_id)::int
  FROM analytics_events ae
  WHERE ae.event_name = 'dish_viewed'
    AND ae.item_id IS NOT NULL
    AND ae.cook_id IS NOT NULL
    AND ae.created_at >= p_date
    AND ae.created_at <  p_date + 1
  GROUP BY ae.item_id, ae.cook_id
  ON CONFLICT (item_id) DO UPDATE SET
    view_count     = dish_metrics.view_count     + EXCLUDED.view_count,
    unique_viewers = dish_metrics.unique_viewers + EXCLUDED.unique_viewers,
    updated_at     = NOW();

  -- Cart adds
  INSERT INTO dish_metrics (item_id, cook_id, cart_add_count)
  SELECT ae.item_id, ae.cook_id, COUNT(*)::int
  FROM analytics_events ae
  WHERE ae.event_name = 'cart_item_added'
    AND ae.item_id IS NOT NULL
    AND ae.cook_id IS NOT NULL
    AND ae.created_at >= p_date
    AND ae.created_at <  p_date + 1
  GROUP BY ae.item_id, ae.cook_id
  ON CONFLICT (item_id) DO UPDATE SET
    cart_add_count = dish_metrics.cart_add_count + EXCLUDED.cart_add_count,
    updated_at     = NOW();

  -- Likes
  INSERT INTO dish_metrics (item_id, cook_id, like_count)
  SELECT ae.item_id, ae.cook_id, COUNT(*)::int
  FROM analytics_events ae
  WHERE ae.event_name = 'dish_liked'
    AND ae.item_id IS NOT NULL
    AND ae.cook_id IS NOT NULL
    AND ae.created_at >= p_date
    AND ae.created_at <  p_date + 1
  GROUP BY ae.item_id, ae.cook_id
  ON CONFLICT (item_id) DO UPDATE SET
    like_count = dish_metrics.like_count + EXCLUDED.like_count,
    updated_at = NOW();

  -- Orders and revenue (from orders table, not events)
  INSERT INTO dish_metrics (item_id, cook_id, order_count, total_revenue)
  SELECT
    o.menu_item_id,
    o.cook_id,
    COUNT(*)::int,
    SUM(o.cook_payout)
  FROM orders o
  WHERE o.created_at >= p_date
    AND o.created_at <  p_date + 1
    AND o.status NOT IN ('cancelled', 'refunded')
  GROUP BY o.menu_item_id, o.cook_id
  ON CONFLICT (item_id) DO UPDATE SET
    order_count   = dish_metrics.order_count   + EXCLUDED.order_count,
    total_revenue = dish_metrics.total_revenue + EXCLUDED.total_revenue,
    updated_at    = NOW();

  -- Recompute derived rates for all updated dishes
  UPDATE dish_metrics SET
    view_to_cart_rate  = CASE WHEN view_count  > 0 THEN cart_add_count::numeric / view_count  ELSE NULL END,
    cart_to_order_rate = CASE WHEN cart_add_count > 0 THEN order_count::numeric / cart_add_count ELSE NULL END,
    avg_order_value    = CASE WHEN order_count > 0 THEN total_revenue / order_count ELSE NULL END;

  -- Slot fill rate from live menu_items data
  UPDATE dish_metrics dm SET
    slot_fill_rate = CASE
      WHEN mi.total_slots > 0 THEN ROUND((mi.slots_claimed::numeric / mi.total_slots) * 100, 2)
      ELSE NULL
    END
  FROM menu_items mi
  WHERE dm.item_id = mi.id;

  -- Craving count from cravings table
  UPDATE dish_metrics dm SET
    craving_count = sub.cnt
  FROM (
    SELECT menu_item_id, COUNT(*)::int AS cnt
    FROM cravings
    WHERE menu_item_id IS NOT NULL
    GROUP BY menu_item_id
  ) sub
  WHERE dm.item_id = sub.menu_item_id;
END;
$$ LANGUAGE plpgsql;


-- ── Aggregation: Creator Daily Metrics ────────────────────────────────────────
-- Full recomputation for a single date across all cooks.
-- Safe to re-run (UPSERT semantics).
CREATE OR REPLACE FUNCTION aggregate_creator_daily(p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO creator_daily_metrics (
    cook_id, date,
    follower_count, new_followers, lost_followers,
    post_views, story_views,
    post_likes, post_comments, post_shares, post_bookmarks,
    posts_published, stories_published,
    orders_received, orders_completed, gross_revenue, net_payout,
    new_customers, repeat_customers, avg_order_value,
    profile_views, dish_views,
    cravings_received, cravings_fulfilled
  )
  SELECT
    cp.id                   AS cook_id,
    p_date                  AS date,

    -- Current follower count (live snapshot)
    (SELECT COUNT(*) FROM follows f WHERE f.cook_id = cp.id)::int,

    -- Followers gained on this date
    COALESCE((SELECT COUNT(*) FROM analytics_events ae
      WHERE ae.event_name = 'cook_followed' AND ae.cook_id = cp.id
        AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,

    -- Followers lost on this date
    COALESCE((SELECT COUNT(*) FROM analytics_events ae
      WHERE ae.event_name = 'cook_unfollowed' AND ae.cook_id = cp.id
        AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,

    -- Post views
    COALESCE((SELECT COUNT(*) FROM analytics_events ae
      WHERE ae.event_name = 'post_viewed' AND ae.cook_id = cp.id
        AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,

    -- Story views
    COALESCE((SELECT COUNT(*) FROM analytics_events ae
      WHERE ae.event_name = 'story_viewed' AND ae.cook_id = cp.id
        AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,

    -- Post engagement
    COALESCE((SELECT COUNT(*) FROM analytics_events ae WHERE ae.event_name = 'post_liked'
      AND ae.cook_id = cp.id AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,
    COALESCE((SELECT COUNT(*) FROM analytics_events ae WHERE ae.event_name = 'post_commented'
      AND ae.cook_id = cp.id AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,
    COALESCE((SELECT COUNT(*) FROM analytics_events ae WHERE ae.event_name = 'post_shared'
      AND ae.cook_id = cp.id AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,
    COALESCE((SELECT COUNT(*) FROM analytics_events ae WHERE ae.event_name = 'post_bookmarked'
      AND ae.cook_id = cp.id AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,

    -- Content published
    COALESCE((SELECT COUNT(*) FROM cook_diary_posts cdp
      WHERE cdp.cook_id = cp.id AND cdp.status = 'published'
        AND cdp.created_at >= p_date AND cdp.created_at < p_date + 1), 0)::int,
    COALESCE((SELECT COUNT(*) FROM stories s
      WHERE s.cook_id = cp.id
        AND s.created_at >= p_date AND s.created_at < p_date + 1), 0)::int,

    -- Orders received (non-cancelled)
    COALESCE((SELECT COUNT(*) FROM orders o
      WHERE o.cook_id = cp.id AND o.status NOT IN ('cancelled', 'refunded')
        AND o.created_at >= p_date AND o.created_at < p_date + 1), 0)::int,

    -- Orders completed on this date
    COALESCE((SELECT COUNT(*) FROM orders o
      WHERE o.cook_id = cp.id AND o.status IN ('delivered', 'completed')
        AND o.updated_at >= p_date AND o.updated_at < p_date + 1), 0)::int,

    -- Gross revenue
    COALESCE((SELECT SUM(o.total_amount) FROM orders o
      WHERE o.cook_id = cp.id AND o.status NOT IN ('cancelled', 'refunded')
        AND o.created_at >= p_date AND o.created_at < p_date + 1), 0),

    -- Net payout
    COALESCE((SELECT SUM(o.cook_payout) FROM orders o
      WHERE o.cook_id = cp.id AND o.status NOT IN ('cancelled', 'refunded')
        AND o.created_at >= p_date AND o.created_at < p_date + 1), 0),

    -- New customers (first-ever order with this cook, placed today)
    COALESCE((
      SELECT COUNT(DISTINCT o.customer_id)
      FROM orders o
      WHERE o.cook_id = cp.id
        AND o.created_at >= p_date AND o.created_at < p_date + 1
        AND o.status NOT IN ('cancelled', 'refunded')
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.cook_id = cp.id AND o2.customer_id = o.customer_id
            AND o2.created_at < p_date
            AND o2.status NOT IN ('cancelled', 'refunded')
        )
    ), 0)::int,

    -- Repeat customers (already ordered before, ordering again today)
    COALESCE((
      SELECT COUNT(DISTINCT o.customer_id)
      FROM orders o
      WHERE o.cook_id = cp.id
        AND o.created_at >= p_date AND o.created_at < p_date + 1
        AND o.status NOT IN ('cancelled', 'refunded')
        AND EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.cook_id = cp.id AND o2.customer_id = o.customer_id
            AND o2.created_at < p_date
            AND o2.status NOT IN ('cancelled', 'refunded')
        )
    ), 0)::int,

    -- Average order value
    COALESCE((SELECT AVG(o.total_amount) FROM orders o
      WHERE o.cook_id = cp.id AND o.status NOT IN ('cancelled', 'refunded')
        AND o.created_at >= p_date AND o.created_at < p_date + 1), 0),

    -- Profile views
    COALESCE((SELECT COUNT(*) FROM analytics_events ae
      WHERE ae.event_name = 'cook_profile_viewed' AND ae.cook_id = cp.id
        AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,

    -- Dish views
    COALESCE((SELECT COUNT(*) FROM analytics_events ae
      WHERE ae.event_name = 'dish_viewed' AND ae.cook_id = cp.id
        AND ae.created_at >= p_date AND ae.created_at < p_date + 1), 0)::int,

    -- Cravings received
    COALESCE((SELECT COUNT(*) FROM cravings c
      WHERE c.cook_id = cp.id
        AND c.created_at >= p_date AND c.created_at < p_date + 1), 0)::int,

    -- Cravings fulfilled
    COALESCE((SELECT COUNT(*) FROM cravings c
      WHERE c.cook_id = cp.id AND c.is_fulfilled = true
        AND c.updated_at >= p_date AND c.updated_at < p_date + 1), 0)::int

  FROM cook_profiles cp

  ON CONFLICT (cook_id, date) DO UPDATE SET
    follower_count    = EXCLUDED.follower_count,
    new_followers     = EXCLUDED.new_followers,
    lost_followers    = EXCLUDED.lost_followers,
    post_views        = EXCLUDED.post_views,
    story_views       = EXCLUDED.story_views,
    post_likes        = EXCLUDED.post_likes,
    post_comments     = EXCLUDED.post_comments,
    post_shares       = EXCLUDED.post_shares,
    post_bookmarks    = EXCLUDED.post_bookmarks,
    posts_published   = EXCLUDED.posts_published,
    stories_published = EXCLUDED.stories_published,
    orders_received   = EXCLUDED.orders_received,
    orders_completed  = EXCLUDED.orders_completed,
    gross_revenue     = EXCLUDED.gross_revenue,
    net_payout        = EXCLUDED.net_payout,
    new_customers     = EXCLUDED.new_customers,
    repeat_customers  = EXCLUDED.repeat_customers,
    avg_order_value   = EXCLUDED.avg_order_value,
    profile_views     = EXCLUDED.profile_views,
    dish_views        = EXCLUDED.dish_views,
    cravings_received = EXCLUDED.cravings_received,
    cravings_fulfilled = EXCLUDED.cravings_fulfilled;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ── Aggregation: Audience Segments ────────────────────────────────────────────
-- Full rebuild from current orders + customer_profiles.
CREATE OR REPLACE FUNCTION rebuild_audience_segments()
RETURNS void AS $$
BEGIN
  DELETE FROM audience_segments;

  -- Dietary preference segments
  INSERT INTO audience_segments (cook_id, segment_type, segment_value, customer_count, order_count, revenue)
  SELECT
    o.cook_id,
    'dietary',
    COALESCE(cp_cust.dietary_type, 'none'),
    COUNT(DISTINCT o.customer_id)::int,
    COUNT(*)::int,
    SUM(o.cook_payout)
  FROM orders o
  LEFT JOIN customer_profiles cp_cust ON cp_cust.user_id = o.customer_id
  WHERE o.status NOT IN ('cancelled', 'refunded')
  GROUP BY o.cook_id, COALESCE(cp_cust.dietary_type, 'none')
  ON CONFLICT (cook_id, segment_type, segment_value) DO UPDATE SET
    customer_count = EXCLUDED.customer_count,
    order_count    = EXCLUDED.order_count,
    revenue        = EXCLUDED.revenue,
    updated_at     = NOW();

  -- Order frequency segments: one_time | occasional (2-4) | regular (5-9) | loyal (10+)
  INSERT INTO audience_segments (cook_id, segment_type, segment_value, customer_count, order_count, revenue)
  SELECT
    cook_id,
    'order_frequency',
    CASE
      WHEN total_orders = 1             THEN 'one_time'
      WHEN total_orders BETWEEN 2 AND 4 THEN 'occasional'
      WHEN total_orders BETWEEN 5 AND 9 THEN 'regular'
      ELSE 'loyal'
    END,
    COUNT(DISTINCT customer_id)::int,
    SUM(total_orders)::int,
    SUM(total_spent)
  FROM (
    SELECT cook_id, customer_id,
           COUNT(*) AS total_orders,
           SUM(cook_payout) AS total_spent
    FROM orders
    WHERE status NOT IN ('cancelled', 'refunded')
    GROUP BY cook_id, customer_id
  ) freq
  GROUP BY cook_id,
    CASE
      WHEN total_orders = 1             THEN 'one_time'
      WHEN total_orders BETWEEN 2 AND 4 THEN 'occasional'
      WHEN total_orders BETWEEN 5 AND 9 THEN 'regular'
      ELSE 'loyal'
    END
  ON CONFLICT (cook_id, segment_type, segment_value) DO UPDATE SET
    customer_count = EXCLUDED.customer_count,
    order_count    = EXCLUDED.order_count,
    revenue        = EXCLUDED.revenue,
    updated_at     = NOW();
END;
$$ LANGUAGE plpgsql;


-- ── Aggregation: Customer Cohorts ──────────────────────────────────────────────
-- Upsert cook-customer relationships from all time orders.
CREATE OR REPLACE FUNCTION rebuild_customer_cohorts()
RETURNS void AS $$
BEGIN
  INSERT INTO customer_cohorts (
    cook_id, customer_id,
    first_order_at, first_order_week, cohort_month,
    order_count, last_order_at, total_spent, is_repeat
  )
  SELECT
    cook_id,
    customer_id,
    MIN(created_at)                           AS first_order_at,
    date_trunc('week', MIN(created_at))::date AS first_order_week,
    to_char(MIN(created_at), 'YYYY-MM')       AS cohort_month,
    COUNT(*)::int                             AS order_count,
    MAX(created_at)                           AS last_order_at,
    SUM(cook_payout)                          AS total_spent,
    COUNT(*) > 1                              AS is_repeat
  FROM orders
  WHERE status NOT IN ('cancelled', 'refunded')
  GROUP BY cook_id, customer_id
  ON CONFLICT (cook_id, customer_id) DO UPDATE SET
    order_count   = EXCLUDED.order_count,
    last_order_at = EXCLUDED.last_order_at,
    total_spent   = EXCLUDED.total_spent,
    is_repeat     = EXCLUDED.is_repeat;
END;
$$ LANGUAGE plpgsql;


-- ── Trigger: Upsert cohort row on each new order ────────────────────────────────
-- Keeps customer_cohorts current without waiting for the nightly job.
CREATE OR REPLACE FUNCTION upsert_customer_cohort()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act on non-cancelled orders transitioning to terminal state
  IF NEW.status NOT IN ('cancelled', 'refunded') AND
     (OLD.status IS NULL OR OLD.status IN ('cancelled', 'refunded') OR
      NEW.customer_id != OLD.customer_id OR NEW.cook_id != OLD.cook_id)
  THEN
    INSERT INTO customer_cohorts (
      cook_id, customer_id,
      first_order_at, first_order_week, cohort_month,
      order_count, last_order_at, total_spent, is_repeat
    )
    VALUES (
      NEW.cook_id,
      NEW.customer_id,
      NEW.created_at,
      date_trunc('week', NEW.created_at)::date,
      to_char(NEW.created_at, 'YYYY-MM'),
      1,
      NEW.created_at,
      NEW.cook_payout,
      FALSE
    )
    ON CONFLICT (cook_id, customer_id) DO UPDATE SET
      order_count   = customer_cohorts.order_count + 1,
      last_order_at = GREATEST(customer_cohorts.last_order_at, NEW.created_at),
      total_spent   = customer_cohorts.total_spent + NEW.cook_payout,
      is_repeat     = customer_cohorts.order_count >= 1; -- already had at least 1 before this
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsert_customer_cohort ON orders;
CREATE TRIGGER trg_upsert_customer_cohort
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION upsert_customer_cohort();
