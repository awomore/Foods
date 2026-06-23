-- Migration 023: Server-side customer interest graph
-- Replaces AsyncStorage cuisine preferences so signals persist across devices
-- and can be used for server-side ranking without client cooperation.

CREATE TABLE IF NOT EXISTS customer_interest_graphs (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cuisine_affinities   jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. {"nigerian": 0.9, "seafood": 0.6, "healthy": 0.4}
  creator_type_affinities jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. {"meal_prep": 0.7, "private_chef": 0.1}
  price_band_min       numeric DEFAULT 0,
  price_band_max       numeric DEFAULT 999999,
  discovery_score      numeric DEFAULT 0.5,   -- 0=loyalist, 1=discoverer
  updated_at           timestamptz DEFAULT now()
);

-- Explicit onboarding cuisine preferences (source of truth replaces AsyncStorage)
CREATE TABLE IF NOT EXISTS user_cuisine_preferences (
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  cuisine    text NOT NULL,
  source     text DEFAULT 'onboarding',  -- 'onboarding'|'inferred'
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, cuisine)
);
