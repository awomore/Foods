-- 059: the creator analytics layer — tables, event columns, and aggregation jobs
--
-- Project memory attributes all of this to "migration 017". No such migration
-- exists in this repo, so none of it was ever created in any database. The
-- consequences, all silent:
--
--   * routes/analytics.js — all 6 creator dashboard endpoints 500 (they read
--     creator_daily_metrics, content_metrics, dish_metrics, follower_snapshots,
--     audience_segments, customer_cohorts).
--   * services/analytics.js emitEvent/emitBatch INSERT 11 columns into
--     analytics_events, which has only 8. Every event insert has been failing,
--     and emitEvent catches its own errors — so the entire event stream has been
--     dropping on the floor with nothing but a console line.
--   * services/scheduler.js calls six stored procedures nightly
--     (snapshot_follower_counts, aggregate_creator_daily,
--     aggregate_content_metrics, aggregate_dish_metrics,
--     rebuild_audience_segments, rebuild_customer_cohorts) that do not exist.
--   * services/marketplaceHealth.js writes marketplace_health_snapshots, missing.
--
-- Every column here is derived from a query that reads it, and every source
-- column was checked against the live production schema. Nothing is invented.
--
-- Revenue conventions, stated because the field names alone are ambiguous:
--   gross_revenue, dish total_revenue, avg_order_value  → orders.total_amount
--   net_payout, content revenue_from_post               → orders.cook_payout
-- revenue_from_post uses cook_payout to match what /analytics/creator/cravings
-- already reports as post_conversion_revenue. Cancelled and refunded orders are
-- excluded from every revenue figure.

-- ── analytics_events: the 5 columns the ingest writes but the table lacks ─────
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS session_id  text;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS post_id     uuid;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS story_id    uuid;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS platform    text;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS app_version text;

-- No foreign keys on these: the event log is append-only and must never reject or
-- cascade because a post or story was later deleted.
CREATE INDEX IF NOT EXISTS idx_analytics_events_post    ON analytics_events (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_item    ON analytics_events (item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON analytics_events (event_name, created_at);

-- ── Aggregation tables ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creator_daily_metrics (
  id                uuid DEFAULT gen_random_uuid() NOT NULL,
  cook_id           uuid NOT NULL,
  date              date NOT NULL,
  orders_received   integer DEFAULT 0 NOT NULL,
  orders_completed  integer DEFAULT 0 NOT NULL,
  gross_revenue     numeric(12,2) DEFAULT 0 NOT NULL,
  net_payout        numeric(12,2) DEFAULT 0 NOT NULL,
  avg_order_value   numeric(12,2) DEFAULT 0 NOT NULL,
  new_customers     integer DEFAULT 0 NOT NULL,
  repeat_customers  integer DEFAULT 0 NOT NULL,
  post_views        integer DEFAULT 0 NOT NULL,
  story_views       integer DEFAULT 0 NOT NULL,
  profile_views     integer DEFAULT 0 NOT NULL,
  dish_views        integer DEFAULT 0 NOT NULL,
  new_followers     integer DEFAULT 0 NOT NULL,
  lost_followers    integer DEFAULT 0 NOT NULL,
  post_likes        integer DEFAULT 0 NOT NULL,
  post_comments     integer DEFAULT 0 NOT NULL,
  post_shares       integer DEFAULT 0 NOT NULL,
  post_bookmarks    integer DEFAULT 0 NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT creator_daily_metrics_pkey PRIMARY KEY (id),
  CONSTRAINT creator_daily_metrics_cook_date_key UNIQUE (cook_id, date),
  CONSTRAINT creator_daily_metrics_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cdm_cook_date ON creator_daily_metrics (cook_id, date DESC);

CREATE TABLE IF NOT EXISTS follower_snapshots (
  id             uuid DEFAULT gen_random_uuid() NOT NULL,
  cook_id        uuid NOT NULL,
  date           date NOT NULL,
  follower_count integer DEFAULT 0 NOT NULL,
  CONSTRAINT follower_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT follower_snapshots_cook_date_key UNIQUE (cook_id, date),
  CONSTRAINT follower_snapshots_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_cook_date ON follower_snapshots (cook_id, date DESC);

CREATE TABLE IF NOT EXISTS content_metrics (
  post_id           uuid NOT NULL,
  cook_id           uuid NOT NULL,
  view_count        integer DEFAULT 0 NOT NULL,
  unique_viewers    integer DEFAULT 0 NOT NULL,
  like_count        integer DEFAULT 0 NOT NULL,
  comment_count     integer DEFAULT 0 NOT NULL,
  share_count       integer DEFAULT 0 NOT NULL,
  bookmark_count    integer DEFAULT 0 NOT NULL,
  order_click_count integer DEFAULT 0 NOT NULL,
  orders_from_post  integer DEFAULT 0 NOT NULL,
  revenue_from_post numeric(12,2) DEFAULT 0 NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT content_metrics_pkey PRIMARY KEY (post_id),
  CONSTRAINT content_metrics_post_id_fkey FOREIGN KEY (post_id) REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  CONSTRAINT content_metrics_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_content_metrics_cook ON content_metrics (cook_id);

CREATE TABLE IF NOT EXISTS dish_metrics (
  item_id            uuid NOT NULL,
  cook_id            uuid NOT NULL,
  view_count         integer DEFAULT 0 NOT NULL,
  unique_viewers     integer DEFAULT 0 NOT NULL,
  like_count         integer DEFAULT 0 NOT NULL,
  craving_count      integer DEFAULT 0 NOT NULL,
  cart_add_count     integer DEFAULT 0 NOT NULL,
  order_count        integer DEFAULT 0 NOT NULL,
  total_revenue      numeric(12,2) DEFAULT 0 NOT NULL,
  repeat_order_count integer DEFAULT 0 NOT NULL,
  view_to_cart_rate  numeric(6,4),
  cart_to_order_rate numeric(6,4),
  slot_fill_rate     numeric(6,4),
  avg_order_value    numeric(12,2),
  updated_at         timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT dish_metrics_pkey PRIMARY KEY (item_id),
  CONSTRAINT dish_metrics_item_id_fkey FOREIGN KEY (item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  CONSTRAINT dish_metrics_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dish_metrics_cook ON dish_metrics (cook_id);

CREATE TABLE IF NOT EXISTS audience_segments (
  id             uuid DEFAULT gen_random_uuid() NOT NULL,
  cook_id        uuid NOT NULL,
  segment_type   text NOT NULL,
  segment_value  text NOT NULL,
  customer_count integer DEFAULT 0 NOT NULL,
  order_count    integer DEFAULT 0 NOT NULL,
  revenue        numeric(12,2) DEFAULT 0 NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT audience_segments_pkey PRIMARY KEY (id),
  CONSTRAINT audience_segments_cook_type_value_key UNIQUE (cook_id, segment_type, segment_value),
  CONSTRAINT audience_segments_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE,
  CONSTRAINT audience_segments_type_check CHECK (segment_type = ANY (ARRAY['dietary'::text, 'order_frequency'::text]))
);
CREATE INDEX IF NOT EXISTS idx_audience_segments_cook ON audience_segments (cook_id, segment_type);

CREATE TABLE IF NOT EXISTS customer_cohorts (
  id             uuid DEFAULT gen_random_uuid() NOT NULL,
  cook_id        uuid NOT NULL,
  customer_id    uuid NOT NULL,
  cohort_month   date NOT NULL,
  first_order_at timestamptz,
  last_order_at  timestamptz,
  order_count    integer DEFAULT 0 NOT NULL,
  total_spent    numeric(12,2) DEFAULT 0 NOT NULL,
  is_repeat      boolean DEFAULT false NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT customer_cohorts_pkey PRIMARY KEY (id),
  CONSTRAINT customer_cohorts_cook_customer_key UNIQUE (cook_id, customer_id),
  CONSTRAINT customer_cohorts_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE,
  CONSTRAINT customer_cohorts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_cook  ON customer_cohorts (cook_id, total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_customer_cohorts_month ON customer_cohorts (cook_id, cohort_month);

CREATE TABLE IF NOT EXISTS marketplace_health_snapshots (
  id                              uuid DEFAULT gen_random_uuid() NOT NULL,
  snapshot_date                   date NOT NULL,
  new_creator_activation_rate_30d numeric(6,2),
  creator_60d_retention_rate      numeric(6,2),
  top10_gmv_concentration         numeric(6,2),
  new_user_first_order_rate_7d    numeric(6,2),
  day30_retention_rate            numeric(6,2),
  interventions_triggered         text[] DEFAULT '{}'::text[] NOT NULL,
  created_at                      timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT marketplace_health_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT marketplace_health_snapshots_date_key UNIQUE (snapshot_date)
);

-- ── Aggregation jobs ─────────────────────────────────────────────────────────
-- Signatures match the calls in services/scheduler.js exactly.
--
-- content/dish metrics and the two rebuilds are FULL recomputes rather than
-- incremental deltas. They are read as cumulative all-time totals, so a full
-- recompute is both correct by construction and immune to the drift an
-- incremental job accumulates when a run is missed. The date argument is kept
-- for signature compatibility and is unused by those two. Revisit if event
-- volume ever makes the scan expensive.

CREATE OR REPLACE FUNCTION snapshot_follower_counts(p_date date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  -- follows holds no unfollow history, so this records the count as it stands
  -- when the job runs. Back-dating p_date does not reconstruct a past count.
  INSERT INTO follower_snapshots (cook_id, date, follower_count)
  SELECT f.cook_id, p_date, COUNT(*)::int
  FROM follows f
  GROUP BY f.cook_id
  ON CONFLICT (cook_id, date) DO UPDATE SET follower_count = EXCLUDED.follower_count;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION aggregate_content_metrics(p_date date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO content_metrics (
    post_id, cook_id, view_count, unique_viewers, like_count, comment_count,
    share_count, bookmark_count, order_click_count, orders_from_post,
    revenue_from_post, updated_at)
  SELECT
    p.id, p.cook_id,
    COALESCE(v.views, 0), COALESCE(v.uniques, 0),
    COALESCE(l.n, 0), COALESCE(c.n, 0), COALESCE(sh.n, 0), COALESCE(bm.n, 0),
    COALESCE(cta.n, 0), COALESCE(o.orders, 0), COALESCE(o.revenue, 0), now()
  FROM cook_diary_posts p
  LEFT JOIN (
    SELECT post_id,
           COUNT(*)::int AS views,
           COUNT(DISTINCT COALESCE(user_id::text, session_id))::int AS uniques
    FROM analytics_events
    WHERE event_name = 'post_viewed' AND post_id IS NOT NULL
    GROUP BY post_id
  ) v ON v.post_id = p.id
  LEFT JOIN (
    SELECT target_id, COUNT(*)::int AS n FROM likes
    WHERE target_type = 'diary_post' GROUP BY target_id
  ) l ON l.target_id = p.id
  LEFT JOIN (
    SELECT post_id, COUNT(*)::int AS n FROM diary_comments
    WHERE deleted_at IS NULL GROUP BY post_id
  ) c ON c.post_id = p.id
  LEFT JOIN (SELECT post_id, COUNT(*)::int AS n FROM post_shares    GROUP BY post_id) sh ON sh.post_id = p.id
  LEFT JOIN (SELECT post_id, COUNT(*)::int AS n FROM post_bookmarks GROUP BY post_id) bm ON bm.post_id = p.id
  LEFT JOIN (
    SELECT post_id, COUNT(*)::int AS n FROM analytics_events
    WHERE event_name = 'post_order_cta_tapped' AND post_id IS NOT NULL GROUP BY post_id
  ) cta ON cta.post_id = p.id
  LEFT JOIN (
    SELECT source_post_id,
           COUNT(*)::int AS orders,
           COALESCE(SUM(cook_payout), 0) AS revenue
    FROM orders
    WHERE source_post_id IS NOT NULL AND status NOT IN ('cancelled', 'refunded')
    GROUP BY source_post_id
  ) o ON o.source_post_id = p.id
  ON CONFLICT (post_id) DO UPDATE SET
    cook_id           = EXCLUDED.cook_id,
    view_count        = EXCLUDED.view_count,
    unique_viewers    = EXCLUDED.unique_viewers,
    like_count        = EXCLUDED.like_count,
    comment_count     = EXCLUDED.comment_count,
    share_count       = EXCLUDED.share_count,
    bookmark_count    = EXCLUDED.bookmark_count,
    order_click_count = EXCLUDED.order_click_count,
    orders_from_post  = EXCLUDED.orders_from_post,
    revenue_from_post = EXCLUDED.revenue_from_post,
    updated_at        = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION aggregate_dish_metrics(p_date date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO dish_metrics (
    item_id, cook_id, view_count, unique_viewers, like_count, craving_count,
    cart_add_count, order_count, total_revenue, repeat_order_count,
    view_to_cart_rate, cart_to_order_rate, slot_fill_rate, avg_order_value, updated_at)
  SELECT
    mi.id, mi.cook_id,
    COALESCE(v.views, 0), COALESCE(v.uniques, 0),
    COALESCE(l.n, 0), COALESCE(cr.n, 0), COALESCE(ca.n, 0),
    COALESCE(o.orders, 0), COALESCE(o.revenue, 0), COALESCE(o.repeats, 0),
    CASE WHEN COALESCE(v.views, 0)  > 0 THEN ROUND(COALESCE(ca.n, 0)::numeric    / v.views, 4) END,
    CASE WHEN COALESCE(ca.n, 0)     > 0 THEN ROUND(COALESCE(o.orders, 0)::numeric / ca.n,   4) END,
    CASE WHEN COALESCE(mi.total_slots, 0) > 0
         THEN ROUND(COALESCE(mi.slots_claimed, 0)::numeric / mi.total_slots, 4) END,
    CASE WHEN COALESCE(o.orders, 0) > 0 THEN ROUND(o.revenue / o.orders, 2) END,
    now()
  FROM menu_items mi
  LEFT JOIN (
    SELECT item_id,
           COUNT(*)::int AS views,
           COUNT(DISTINCT COALESCE(user_id::text, session_id))::int AS uniques
    FROM analytics_events
    WHERE event_name = 'dish_viewed' AND item_id IS NOT NULL
    GROUP BY item_id
  ) v ON v.item_id = mi.id
  LEFT JOIN (
    SELECT target_id, COUNT(*)::int AS n FROM likes
    WHERE target_type = 'menu_item' GROUP BY target_id
  ) l ON l.target_id = mi.id
  LEFT JOIN (
    SELECT menu_item_id, COUNT(*)::int AS n FROM cravings
    WHERE menu_item_id IS NOT NULL GROUP BY menu_item_id
  ) cr ON cr.menu_item_id = mi.id
  LEFT JOIN (
    SELECT item_id, COUNT(*)::int AS n FROM analytics_events
    WHERE event_name = 'cart_item_added' AND item_id IS NOT NULL GROUP BY item_id
  ) ca ON ca.item_id = mi.id
  LEFT JOIN (
    -- repeats counts every order beyond a customer's first for this dish
    SELECT menu_item_id,
           SUM(cnt)::int                          AS orders,
           COALESCE(SUM(spend), 0)                AS revenue,
           COALESCE(SUM(GREATEST(cnt - 1, 0)), 0)::int AS repeats
    FROM (
      SELECT menu_item_id, customer_id,
             COUNT(*) AS cnt, SUM(total_amount) AS spend
      FROM orders
      WHERE menu_item_id IS NOT NULL AND status NOT IN ('cancelled', 'refunded')
      GROUP BY menu_item_id, customer_id
    ) per_customer
    GROUP BY menu_item_id
  ) o ON o.menu_item_id = mi.id
  ON CONFLICT (item_id) DO UPDATE SET
    cook_id            = EXCLUDED.cook_id,
    view_count         = EXCLUDED.view_count,
    unique_viewers     = EXCLUDED.unique_viewers,
    like_count         = EXCLUDED.like_count,
    craving_count      = EXCLUDED.craving_count,
    cart_add_count     = EXCLUDED.cart_add_count,
    order_count        = EXCLUDED.order_count,
    total_revenue      = EXCLUDED.total_revenue,
    repeat_order_count = EXCLUDED.repeat_order_count,
    view_to_cart_rate  = EXCLUDED.view_to_cart_rate,
    cart_to_order_rate = EXCLUDED.cart_to_order_rate,
    slot_fill_rate     = EXCLUDED.slot_fill_rate,
    avg_order_value    = EXCLUDED.avg_order_value,
    updated_at         = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION aggregate_creator_daily(p_date date DEFAULT CURRENT_DATE)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  -- Only cooks with a signal on p_date get a row; otherwise every cook would
  -- accrue an all-zero row every single day.
  INSERT INTO creator_daily_metrics (
    cook_id, date, orders_received, orders_completed, gross_revenue, net_payout,
    avg_order_value, new_customers, repeat_customers, post_views, story_views,
    profile_views, dish_views, new_followers, lost_followers, post_likes,
    post_comments, post_shares, post_bookmarks, updated_at)
  SELECT
    c.cook_id, p_date,
    COALESCE(o.orders_received, 0), COALESCE(o.orders_completed, 0),
    COALESCE(o.gross_revenue, 0),   COALESCE(o.net_payout, 0),
    CASE WHEN COALESCE(o.paid_orders, 0) > 0
         THEN ROUND(o.gross_revenue / o.paid_orders, 2) ELSE 0 END,
    COALESCE(cust.new_customers, 0), COALESCE(cust.repeat_customers, 0),
    COALESCE(e.post_views, 0), COALESCE(e.story_views, 0),
    COALESCE(e.profile_views, 0), COALESCE(e.dish_views, 0),
    COALESCE(fl.new_followers, 0), COALESCE(e.lost_followers, 0),
    COALESCE(e.post_likes, 0), COALESCE(e.post_comments, 0),
    COALESCE(e.post_shares, 0), COALESCE(e.post_bookmarks, 0),
    now()
  FROM (
    SELECT cook_id FROM orders            WHERE created_at::date = p_date AND cook_id IS NOT NULL
    UNION SELECT cook_id FROM analytics_events WHERE created_at::date = p_date AND cook_id IS NOT NULL
    UNION SELECT cook_id FROM follows      WHERE created_at::date = p_date AND cook_id IS NOT NULL
  ) c
  LEFT JOIN (
    SELECT cook_id,
           COUNT(*)::int                                                              AS orders_received,
           COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded'))::int         AS paid_orders,
           COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS gross_revenue,
           COALESCE(SUM(cook_payout)  FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS net_payout,
           COUNT(*) FILTER (WHERE delivered_at::date = p_date)::int                    AS orders_completed
    FROM orders WHERE created_at::date = p_date OR delivered_at::date = p_date
    GROUP BY cook_id
  ) o ON o.cook_id = c.cook_id
  LEFT JOIN (
    SELECT cook_id,
           COUNT(*) FILTER (WHERE is_first)::int     AS new_customers,
           COUNT(*) FILTER (WHERE NOT is_first)::int AS repeat_customers
    FROM (
      SELECT DISTINCT ON (o1.cook_id, o1.customer_id)
             o1.cook_id, o1.customer_id,
             NOT EXISTS (
               SELECT 1 FROM orders o0
               WHERE o0.cook_id = o1.cook_id AND o0.customer_id = o1.customer_id
                 AND o0.created_at::date < p_date
                 AND o0.status NOT IN ('cancelled','refunded')
             ) AS is_first
      FROM orders o1
      WHERE o1.created_at::date = p_date AND o1.status NOT IN ('cancelled','refunded')
    ) firsts
    GROUP BY cook_id
  ) cust ON cust.cook_id = c.cook_id
  LEFT JOIN (
    SELECT cook_id,
           COUNT(*) FILTER (WHERE event_name = 'post_viewed')::int         AS post_views,
           COUNT(*) FILTER (WHERE event_name = 'story_viewed')::int        AS story_views,
           COUNT(*) FILTER (WHERE event_name = 'cook_profile_viewed')::int AS profile_views,
           COUNT(*) FILTER (WHERE event_name = 'dish_viewed')::int         AS dish_views,
           COUNT(*) FILTER (WHERE event_name = 'cook_unfollowed')::int     AS lost_followers,
           COUNT(*) FILTER (WHERE event_name = 'post_liked')::int          AS post_likes,
           COUNT(*) FILTER (WHERE event_name = 'post_commented')::int      AS post_comments,
           COUNT(*) FILTER (WHERE event_name = 'post_shared')::int         AS post_shares,
           COUNT(*) FILTER (WHERE event_name = 'post_bookmarked')::int     AS post_bookmarks
    FROM analytics_events WHERE created_at::date = p_date
    GROUP BY cook_id
  ) e ON e.cook_id = c.cook_id
  LEFT JOIN (
    SELECT cook_id, COUNT(*)::int AS new_followers
    FROM follows WHERE created_at::date = p_date
    GROUP BY cook_id
  ) fl ON fl.cook_id = c.cook_id
  ON CONFLICT (cook_id, date) DO UPDATE SET
    orders_received  = EXCLUDED.orders_received,
    orders_completed = EXCLUDED.orders_completed,
    gross_revenue    = EXCLUDED.gross_revenue,
    net_payout       = EXCLUDED.net_payout,
    avg_order_value  = EXCLUDED.avg_order_value,
    new_customers    = EXCLUDED.new_customers,
    repeat_customers = EXCLUDED.repeat_customers,
    post_views       = EXCLUDED.post_views,
    story_views      = EXCLUDED.story_views,
    profile_views    = EXCLUDED.profile_views,
    dish_views       = EXCLUDED.dish_views,
    new_followers    = EXCLUDED.new_followers,
    lost_followers   = EXCLUDED.lost_followers,
    post_likes       = EXCLUDED.post_likes,
    post_comments    = EXCLUDED.post_comments,
    post_shares      = EXCLUDED.post_shares,
    post_bookmarks   = EXCLUDED.post_bookmarks,
    updated_at       = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION rebuild_customer_cohorts()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO customer_cohorts (
    cook_id, customer_id, cohort_month, first_order_at, last_order_at,
    order_count, total_spent, is_repeat, updated_at)
  SELECT
    cook_id, customer_id,
    date_trunc('month', MIN(created_at))::date,
    MIN(created_at), MAX(created_at),
    COUNT(*)::int, COALESCE(SUM(total_amount), 0), COUNT(*) > 1, now()
  FROM orders
  WHERE cook_id IS NOT NULL AND customer_id IS NOT NULL
    AND status NOT IN ('cancelled', 'refunded')
  GROUP BY cook_id, customer_id
  ON CONFLICT (cook_id, customer_id) DO UPDATE SET
    cohort_month   = EXCLUDED.cohort_month,
    first_order_at = EXCLUDED.first_order_at,
    last_order_at  = EXCLUDED.last_order_at,
    order_count    = EXCLUDED.order_count,
    total_spent    = EXCLUDED.total_spent,
    is_repeat      = EXCLUDED.is_repeat,
    updated_at     = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION rebuild_audience_segments()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  -- Full rebuild: segment membership shrinks as well as grows, and an upsert
  -- alone would leave stale rows behind for segments a cook no longer has.
  DELETE FROM audience_segments;

  -- Dietary mix of the customers who actually ordered.
  INSERT INTO audience_segments (cook_id, segment_type, segment_value, customer_count, order_count, revenue, updated_at)
  SELECT o.cook_id, 'dietary',
         COALESCE(NULLIF(cp.dietary_type, ''), 'unspecified'),
         COUNT(DISTINCT o.customer_id)::int, COUNT(*)::int,
         COALESCE(SUM(o.total_amount), 0), now()
  FROM orders o
  LEFT JOIN customer_profiles cp ON cp.user_id = o.customer_id
  WHERE o.cook_id IS NOT NULL AND o.status NOT IN ('cancelled', 'refunded')
  GROUP BY o.cook_id, COALESCE(NULLIF(cp.dietary_type, ''), 'unspecified');

  -- Order-frequency buckets, derived per cook-customer pair.
  INSERT INTO audience_segments (cook_id, segment_type, segment_value, customer_count, order_count, revenue, updated_at)
  SELECT cook_id, 'order_frequency', bucket,
         COUNT(*)::int, SUM(cnt)::int, COALESCE(SUM(spend), 0), now()
  FROM (
    SELECT cook_id, customer_id, COUNT(*) AS cnt, SUM(total_amount) AS spend,
           CASE WHEN COUNT(*) = 1 THEN '1 order'
                WHEN COUNT(*) BETWEEN 2 AND 3 THEN '2-3 orders'
                ELSE '4+ orders' END AS bucket
    FROM orders
    WHERE cook_id IS NOT NULL AND status NOT IN ('cancelled', 'refunded')
    GROUP BY cook_id, customer_id
  ) per_customer
  GROUP BY cook_id, bucket;

  SELECT COUNT(*)::int INTO n FROM audience_segments;
  RETURN n;
END $$;

-- Keeps one cohort row current on every order write, so /creator/audience and
-- /creator/orders are not stale until the 02:30 rebuild.
CREATE OR REPLACE FUNCTION upsert_customer_cohort()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cook_id IS NULL OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO customer_cohorts (
    cook_id, customer_id, cohort_month, first_order_at, last_order_at,
    order_count, total_spent, is_repeat, updated_at)
  SELECT
    cook_id, customer_id,
    date_trunc('month', MIN(created_at))::date,
    MIN(created_at), MAX(created_at),
    COUNT(*)::int, COALESCE(SUM(total_amount), 0), COUNT(*) > 1, now()
  FROM orders
  WHERE cook_id = NEW.cook_id AND customer_id = NEW.customer_id
    AND status NOT IN ('cancelled', 'refunded')
  GROUP BY cook_id, customer_id
  ON CONFLICT (cook_id, customer_id) DO UPDATE SET
    cohort_month   = EXCLUDED.cohort_month,
    first_order_at = EXCLUDED.first_order_at,
    last_order_at  = EXCLUDED.last_order_at,
    order_count    = EXCLUDED.order_count,
    total_spent    = EXCLUDED.total_spent,
    is_repeat      = EXCLUDED.is_repeat,
    updated_at     = now();

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_upsert_customer_cohort ON orders;
CREATE TRIGGER trg_upsert_customer_cohort
  AFTER INSERT OR UPDATE OF status, total_amount ON orders
  FOR EACH ROW EXECUTE FUNCTION upsert_customer_cohort();
