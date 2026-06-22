-- Add rider rating columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_rating SMALLINT CHECK (rider_rating BETWEEN 1 AND 5);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_rated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_rating_note TEXT;

-- Add rating aggregation columns to rider_profiles
ALTER TABLE rider_profiles ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE rider_profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Create zones table
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  service_areas TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add commission rate columns
ALTER TABLE fleet_operators ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) DEFAULT 0.15;
ALTER TABLE rider_profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);

