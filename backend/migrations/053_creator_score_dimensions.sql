-- ============================================================
-- 053 — creator_score_dimensions (schema-drift fix)
-- ============================================================
-- services/creatorScore.js recomputes a per-cook creator score and UPSERTs it
-- into `creator_score_dimensions` (ON CONFLICT (cook_id)). Six read paths LEFT
-- JOIN this table for ranking — routes/cooks.js, discover.js, feed.js,
-- followSuggestions.js, weeklyMenus.js — via COALESCE(csd.creator_score, 0).
-- The table was never created by any migration, so GET /cooks and GET /discover
-- (and the other ranked surfaces) 500'd with
-- `relation "creator_score_dimensions" does not exist`.
--
-- Because every reader LEFT JOINs and COALESCEs to 0, creating the table (even
-- empty) restores those endpoints with zero behaviour change; the nightly
-- batchRecomputeAll() then populates real scores. Column set + the (cook_id)
-- conflict target mirror the writer exactly. All score/rate columns are
-- fractions in [0,1] except the per-week activity counts.
--
-- Additive + idempotent — safe and reversible (see 053_..down.sql).

CREATE TABLE IF NOT EXISTS creator_score_dimensions (
  cook_id                   UUID PRIMARY KEY REFERENCES cook_profiles(id) ON DELETE CASCADE,

  -- Composite dimensions (each already weighted into creator_score)
  order_quality             NUMERIC(6,4) NOT NULL DEFAULT 0,
  reliability               NUMERIC(6,4) NOT NULL DEFAULT 0,
  content_activity          NUMERIC(6,4) NOT NULL DEFAULT 0,
  audience_health           NUMERIC(6,4) NOT NULL DEFAULT 0,
  trust_verify              NUMERIC(6,4) NOT NULL DEFAULT 0,
  marketplace_contrib       NUMERIC(6,4) NOT NULL DEFAULT 0,
  creator_score             NUMERIC(6,4) NOT NULL DEFAULT 0,

  -- Underlying metrics (for transparency / debugging the score)
  avg_rating_90d            NUMERIC(6,4) NOT NULL DEFAULT 0,
  completion_rate_90d       NUMERIC(6,4) NOT NULL DEFAULT 0,
  repeat_order_rate         NUMERIC(6,4) NOT NULL DEFAULT 0,
  on_time_rate              NUMERIC(6,4) NOT NULL DEFAULT 0,
  response_rate             NUMERIC(6,4) NOT NULL DEFAULT 0,
  cancellation_rate         NUMERIC(6,4) NOT NULL DEFAULT 0,
  posts_per_week            NUMERIC(8,2) NOT NULL DEFAULT 0,
  stories_per_week          NUMERIC(8,2) NOT NULL DEFAULT 0,
  follower_to_order_conv    NUMERIC(6,4) NOT NULL DEFAULT 0,
  follower_growth_rate_30d  NUMERIC(6,4) NOT NULL DEFAULT 0,
  story_completion_rate     NUMERIC(6,4) NOT NULL DEFAULT 0,
  gmv_growth_rate_30d       NUMERIC(6,4) NOT NULL DEFAULT 0,
  new_customer_rate_30d     NUMERIC(6,4) NOT NULL DEFAULT 0,

  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ranking reads order by creator_score DESC across the approved-cook set.
CREATE INDEX IF NOT EXISTS idx_creator_score_dimensions_score
  ON creator_score_dimensions (creator_score DESC);
