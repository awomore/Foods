-- Migration 043: rider ratings, delivery zones, commission config

-- Rider rating columns on orders (per-delivery rating of the RIDER)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_rating       SMALLINT CHECK (rider_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rider_rated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rider_rating_note  TEXT;

-- Rider aggregate rating on rider_profiles
ALTER TABLE rider_profiles
  ADD COLUMN IF NOT EXISTS average_rating  NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count    INTEGER DEFAULT 0;

-- Delivery zones (for territory management)
CREATE TABLE IF NOT EXISTS zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  service_areas TEXT[] DEFAULT '{}',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Commission configuration (platform rate per operator or per solo rider)
-- Default 15% platform fee; stored as a fraction (0.15 = 15%)
ALTER TABLE fleet_operators
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) DEFAULT 0.15;

-- Solo riders (not under an operator) can have individual commission rates
ALTER TABLE rider_profiles
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);
  -- NULL means inherit platform default (15%)
