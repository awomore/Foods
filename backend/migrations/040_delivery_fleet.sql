-- ══════════════════════════════════════════════════════════════════════════════
-- 040_delivery_fleet.sql — Delivery Network & Fleet Management
-- Adds: logistics choice, promised windows, OTPs, delivery fee payment,
--       fleet operators, rider profiles, fleet vehicles
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. New columns on orders ──────────────────────────────────────────────────

ALTER TABLE orders
  -- Logistics choice (cook sets at accept time)
  ADD COLUMN IF NOT EXISTS logistics_type              TEXT DEFAULT 'fez',
    -- 'fez' | 'foods_network' | 'off_platform'

  -- Prep time: cook enters at accept, used to compute delivery window
  ADD COLUMN IF NOT EXISTS prep_time_minutes           INTEGER,

  -- Off-platform rider details (cook fills when dispatching own rider)
  ADD COLUMN IF NOT EXISTS off_platform_rider_name     TEXT,
  ADD COLUMN IF NOT EXISTS off_platform_rider_phone    TEXT,
  ADD COLUMN IF NOT EXISTS off_platform_eta            TIMESTAMPTZ,

  -- Customer receipt confirmation (escrow release for off-platform orders)
  ADD COLUMN IF NOT EXISTS customer_confirmed_receipt  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at       TIMESTAMPTZ,

  -- Delivery fee payment method
  ADD COLUMN IF NOT EXISTS delivery_fee_payment_method TEXT DEFAULT 'wallet',
    -- 'wallet' | 'cash' | 'transfer'
  ADD COLUMN IF NOT EXISTS delivery_fee_paid_to_rider  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee_paid_at        TIMESTAMPTZ,

  -- OTP verification (copied from cook's otp_required setting at order creation)
  ADD COLUMN IF NOT EXISTS otp_enabled                 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_otp              TEXT,   -- rider enters at pickup
  ADD COLUMN IF NOT EXISTS collection_otp_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_otp                TEXT,   -- customer shows to rider
  ADD COLUMN IF NOT EXISTS delivery_otp_verified_at    TIMESTAMPTZ,

  -- FOODS network rider assignment
  ADD COLUMN IF NOT EXISTS assigned_rider_id           UUID;   -- FK added after rider_profiles created

-- ── 2. OTP setting on cook_profiles ──────────────────────────────────────────

ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS otp_required BOOLEAN DEFAULT false;

-- ── 3. fleet_operators ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_operators (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        REFERENCES users(id) ON DELETE SET NULL,
  operator_type        TEXT        NOT NULL CHECK (operator_type IN ('company', 'individual')),
  business_name        TEXT        NOT NULL,
  contact_name         TEXT        NOT NULL,
  contact_phone        TEXT        NOT NULL,
  contact_email        TEXT,
  vehicle_types        TEXT[]      NOT NULL DEFAULT '{}',  -- ['bike','bicycle']
  vehicle_count        INTEGER     NOT NULL DEFAULT 1,
  service_areas        TEXT[]      NOT NULL DEFAULT '{}',  -- LGA / city names
  id_document_url      TEXT,
  vehicle_docs_url     TEXT,
  insurance_url        TEXT,
  bank_name            TEXT,
  bank_account_number  TEXT,
  bank_account_name    TEXT,
  bank_code            TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected','suspended')),
  rejection_reason     TEXT,
  approved_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_operators_status  ON fleet_operators(status);
CREATE INDEX IF NOT EXISTS idx_fleet_operators_user    ON fleet_operators(user_id);

-- ── 4. rider_profiles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rider_profiles (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        REFERENCES users(id) ON DELETE CASCADE,
  fleet_operator_id        UUID        REFERENCES fleet_operators(id) ON DELETE SET NULL,
  -- null fleet_operator_id = solo rider
  full_name                TEXT        NOT NULL,
  phone                    TEXT        NOT NULL,
  vehicle_type             TEXT        NOT NULL CHECK (vehicle_type IN ('bike','bicycle')),
  vehicle_plate            TEXT,
  government_id_url        TEXT,
  vehicle_registration_url TEXT,
  service_areas            TEXT[]      NOT NULL DEFAULT '{}',
  bank_name                TEXT,
  bank_account_number      TEXT,
  bank_account_name        TEXT,
  bank_code                TEXT,
  is_available             BOOLEAN     NOT NULL DEFAULT false,
  current_latitude         NUMERIC(10,7),
  current_longitude        NUMERIC(10,7),
  last_location_at         TIMESTAMPTZ,
  status                   TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','rejected','suspended')),
  rejection_reason         TEXT,
  approved_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
  approved_at              TIMESTAMPTZ,
  total_deliveries         INTEGER     NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_profiles_status    ON rider_profiles(status);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_user      ON rider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_fleet     ON rider_profiles(fleet_operator_id);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_available ON rider_profiles(is_available) WHERE is_available = true;

-- ── 5. fleet_vehicles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_operator_id    UUID        NOT NULL REFERENCES fleet_operators(id) ON DELETE CASCADE,
  vehicle_type         TEXT        NOT NULL CHECK (vehicle_type IN ('bike','bicycle')),
  plate_number         TEXT,
  registration_doc_url TEXT,
  assigned_rider_id    UUID        REFERENCES rider_profiles(id) ON DELETE SET NULL,
  status               TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','maintenance','retired')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_operator ON fleet_vehicles(fleet_operator_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_rider    ON fleet_vehicles(assigned_rider_id);

-- ── 6. FK: orders.assigned_rider_id → rider_profiles ─────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_orders_assigned_rider' AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT fk_orders_assigned_rider
      FOREIGN KEY (assigned_rider_id) REFERENCES rider_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 7. Indexes on new orders columns ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_logistics_type   ON orders(logistics_type);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider   ON orders(assigned_rider_id) WHERE assigned_rider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_otp_enabled      ON orders(otp_enabled)       WHERE otp_enabled = true;
