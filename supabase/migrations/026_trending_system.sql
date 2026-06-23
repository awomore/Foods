-- Migration 026: Multi-entity trending scores
-- Replaces simple COUNT(*) trending with velocity-based scoring that
-- requires unique users and order conversion, making it harder to game
-- with repeated searches from one account.

CREATE TABLE IF NOT EXISTS trending_entities (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type                 text NOT NULL,  -- 'dish'|'creator'|'search'|'cuisine'|'menu'
  entity_id                   uuid,           -- null for search terms / cuisine labels
  entity_label                text,           -- for search terms and cuisine trending
  -- Velocity components (each 0.0–1.0 normalised within entity_type)
  order_velocity              numeric DEFAULT 0,           -- weight 40%
  new_customer_velocity       numeric DEFAULT 0,           -- weight 30%
  geo_spread_score            numeric DEFAULT 0,           -- weight 15%
  content_engagement_velocity numeric DEFAULT 0,           -- weight 15%
  -- Composite trending score
  trending_score              numeric DEFAULT 0,
  window_days                 integer DEFAULT 7,
  computed_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS te_type_score
  ON trending_entities(entity_type, trending_score DESC);

CREATE INDEX IF NOT EXISTS te_computed_at
  ON trending_entities(computed_at);

-- Enrich existing search_trending with deduplication and conversion data
ALTER TABLE search_trending ADD COLUMN IF NOT EXISTS unique_user_count         integer DEFAULT 1;
ALTER TABLE search_trending ADD COLUMN IF NOT EXISTS order_conversion_count    integer DEFAULT 0;
