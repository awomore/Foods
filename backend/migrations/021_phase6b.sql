-- ============================================================
-- FOODS Phase 6B — Creator Commerce Experience Completion
-- Migration 021_phase6b.sql
-- ============================================================

-- ── AREA 1: Chef Service Settings ──────────────────────────
-- Unified table for geography, pricing tiers, and requirements per chef

CREATE TABLE IF NOT EXISTS chef_service_settings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id               UUID        NOT NULL UNIQUE REFERENCES cook_profiles(id) ON DELETE CASCADE,

  -- Geography
  cities_served         TEXT[]      DEFAULT '{}',
  states_served         TEXT[]      DEFAULT '{}',
  travel_radius_km      INTEGER     DEFAULT 50,
  nationwide            BOOLEAN     DEFAULT false,
  travel_fee_flat       NUMERIC(12,2),
  travel_fee_per_km     NUMERIC(12,2),

  -- Base rates
  hourly_rate           NUMERIC(12,2),
  day_rate              NUMERIC(12,2),
  event_rate            NUMERIC(12,2),
  minimum_spend         NUMERIC(12,2),

  -- Guest tiers: [{min_guests, max_guests, rate_per_head, flat_rate, label}]
  guest_tiers           JSONB       DEFAULT '[]',

  -- Requirements
  notice_hours          INTEGER     DEFAULT 48,
  deposit_pct           NUMERIC(5,2) DEFAULT 30,
  equipment_notes       TEXT,
  kitchen_notes         TEXT,
  ingredients_by_client BOOLEAN     DEFAULT false,
  accommodation_required BOOLEAN    DEFAULT false,

  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Extend chef_availability: working hours, booking cap, blackout/vacation flags
ALTER TABLE chef_availability
  ADD COLUMN IF NOT EXISTS start_time    TIME,
  ADD COLUMN IF NOT EXISTS end_time      TIME,
  ADD COLUMN IF NOT EXISTS max_bookings  INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_vacation   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blackout   BOOLEAN DEFAULT false;

-- ── AREA 2: Custom Request Negotiation Thread ────────────────
ALTER TABLE custom_requests
  ADD COLUMN IF NOT EXISTS delivery_date       DATE,
  ADD COLUMN IF NOT EXISTS quantity            INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_count      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_versions      JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS negotiation_notes   TEXT,
  ADD COLUMN IF NOT EXISTS escrow_hold_id      UUID;

CREATE TABLE IF NOT EXISTS custom_request_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID        NOT NULL REFERENCES custom_requests(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN ('customer','cook','admin')),
  message      TEXT        NOT NULL,
  attachments  TEXT[]      DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_request_messages_request
  ON custom_request_messages (request_id, created_at ASC);

-- ── AREA 6: Social Conversion Tracking ──────────────────────
CREATE TABLE IF NOT EXISTS social_conversions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT        NOT NULL CHECK (event_type IN (
                 'social_click','social_visit','social_follow',
                 'social_order','social_conversion'
               )),
  entity_type  TEXT        CHECK (entity_type IN ('creator','dish','course','service','menu')),
  entity_slug  TEXT,
  source       TEXT        CHECK (source IN ('whatsapp','x','instagram','facebook','other')),
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  ip_hash      TEXT,
  referrer     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_conversions_type
  ON social_conversions (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_conversions_entity
  ON social_conversions (entity_type, entity_slug, created_at DESC);

-- ── AREA 7: Video View / Completion Tracking ─────────────────
CREATE TABLE IF NOT EXISTS video_views (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT        NOT NULL CHECK (entity_type IN (
                  'menu_item','post','story','course','customer_post'
                )),
  entity_id     UUID        NOT NULL,
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  watch_seconds INTEGER     DEFAULT 0,
  completed     BOOLEAN     DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_views_entity
  ON video_views (entity_type, entity_id, created_at DESC);

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS video_view_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_completion_count INTEGER DEFAULT 0;

ALTER TABLE cook_diary_posts
  ADD COLUMN IF NOT EXISTS video_view_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_completion_count INTEGER DEFAULT 0;

-- ── AREA 9: Order SLA & Fault Attribution ───────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sla_deadline       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_late            BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_by_minutes    INTEGER,
  ADD COLUMN IF NOT EXISTS fulfillment_score  NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS fault_attribution  TEXT CHECK (fault_attribution IN ('cook','customer','rider','platform'));

-- ── AREA 10: Dispute Fault Attribution & Penalty System ─────
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS fault_attribution  TEXT CHECK (fault_attribution IN ('cook','customer','rider','platform')),
  ADD COLUMN IF NOT EXISTS penalty_type       TEXT CHECK (penalty_type IN ('warning','strike','suspension','ban')),
  ADD COLUMN IF NOT EXISTS penalty_applied_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS account_strikes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dispute_id  UUID        REFERENCES disputes(id) ON DELETE SET NULL,
  strike_type TEXT        NOT NULL CHECK (strike_type IN ('warning','strike','suspension','ban')),
  reason      TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN     DEFAULT true,
  issued_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_strikes_user
  ON account_strikes (user_id, is_active, created_at DESC);

-- ── AREA 11: Course Certificates & Student Progress ──────────
ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS progress_pct          NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lessons_completed     INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS certificate_issued    BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_url       TEXT,
  ADD COLUMN IF NOT EXISTS certificate_issued_at TIMESTAMPTZ;

-- ── AREA 15: Escrow Auto-Release & Multi-Type ───────────────
ALTER TABLE escrow_holds
  ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escrow_type     TEXT DEFAULT 'food_order' CHECK (escrow_type IN (
                             'food_order','course','private_chef','custom_order','bulk_order'
                           )),
  ADD COLUMN IF NOT EXISTS source_id       UUID;

-- Index to power the auto-release worker
CREATE INDEX IF NOT EXISTS idx_escrow_auto_release
  ON escrow_holds (auto_release_at)
  WHERE status = 'held' AND payout_blocked = false AND auto_release_at IS NOT NULL;

-- ── AREA 17: Search — catering/events as distinct types ─────
-- Add category_tag to distinguish event catering bookings
-- Table renamed catering_bookings to catering_events, guard for both
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catering_bookings' AND table_schema = 'public') THEN
    ALTER TABLE catering_bookings ADD COLUMN IF NOT EXISTS event_tag TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catering_events' AND table_schema = 'public') THEN
    ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS event_tag TEXT;
  END IF;
END $$
