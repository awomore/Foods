-- Migration 024: 6-dimension creator quality scores (Creator Trust Graph)
-- Replaces average_rating + total_orders as the primary ranking signal.
-- Composite score uses growth rates not absolute volumes to prevent
-- established creators from permanently dominating new entrants.

CREATE TABLE IF NOT EXISTS creator_score_dimensions (
  cook_id              uuid PRIMARY KEY REFERENCES cook_profiles(id) ON DELETE CASCADE,
  -- Normalised dimension scores (0.0–1.0)
  order_quality        numeric DEFAULT 0,   -- weight 35%
  reliability          numeric DEFAULT 0,   -- weight 20%
  content_activity     numeric DEFAULT 0,   -- weight 15%
  audience_health      numeric DEFAULT 0,   -- weight 15%
  trust_verify         numeric DEFAULT 0,   -- weight 10%
  marketplace_contrib  numeric DEFAULT 0,   -- weight  5%
  -- Composite (computed by application, stored for fast ORDER BY)
  creator_score        numeric DEFAULT 0,
  -- Raw inputs (stored so recomputation can be done incrementally)
  avg_rating_90d             numeric DEFAULT 0,
  completion_rate_90d        numeric DEFAULT 0,
  repeat_order_rate          numeric DEFAULT 0,
  on_time_rate               numeric DEFAULT 1,
  response_rate              numeric DEFAULT 1,
  cancellation_rate          numeric DEFAULT 0,
  posts_per_week             numeric DEFAULT 0,
  stories_per_week           numeric DEFAULT 0,
  follower_to_order_conv     numeric DEFAULT 0,
  follower_growth_rate_30d   numeric DEFAULT 0,
  story_completion_rate      numeric DEFAULT 0,
  gmv_growth_rate_30d        numeric DEFAULT 0,
  new_customer_rate_30d      numeric DEFAULT 0,
  updated_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS csd_creator_score_idx
  ON creator_score_dimensions(creator_score DESC);

-- Dish-level order signals (used in discover dish ranking)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS order_count_90d    integer DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS reorder_rate       numeric DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cancellation_rate  numeric DEFAULT 0;

-- Story completion tracking (missing from original schema)
CREATE TABLE IF NOT EXISTS story_completions (
  story_id    uuid REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id   uuid REFERENCES users(id)   ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
