-- ============================================================
-- 001_base_schema.sql — FOODSbyme Base Schema
-- Creates all foundational tables that existed BEFORE migration 013_social.sql.
-- Columns added by migrations 013–040 are NOT included here.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── users ────────────────────────────────────────────────────
-- Core user table. role made nullable by 015_role_nullable (not needed here).
-- tos fields added by 025; fraud/risk fields added by 023; country_code by 029;
-- push_token (legacy column) referenced by follows broadcast in auth.
-- phone made nullable by 035_social_identities; email stays nullable too.
CREATE TABLE IF NOT EXISTS users (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT        UNIQUE,
  phone                 TEXT        UNIQUE,                   -- 035 made nullable; start nullable
  password_hash         TEXT,
  role                  TEXT        CHECK (role IN ('customer','cook','admin')),  -- 015 dropped NOT NULL
  full_name             TEXT,
  username              TEXT        UNIQUE,
  avatar_url            TEXT,
  bio                   TEXT,
  push_token            TEXT,                                 -- legacy single-token field (used by follows broadcast)
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  deletion_requested_at TIMESTAMPTZ,
  deletion_reason       TEXT,
  following_count       INTEGER     NOT NULL DEFAULT 0,
  follower_count        INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by later migrations (DO NOT include here):
  --   025: tos_accepted_at, tos_version, privacy_accepted_at
  --   023: fraud_flagged, fraud_flagged_at, account_risk_level, device_fingerprints
  --   029: country_code
  --   037: referral_code
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone    ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON users (role);

-- ── otp_codes ────────────────────────────────────────────────
-- OTP send/verify for phone auth. Rate-limit columns added by 026.
CREATE TABLE IF NOT EXISTS otp_codes (
  phone      TEXT        PRIMARY KEY,
  code       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 026: send_count, send_window_start
);

-- ── cook_profiles ─────────────────────────────────────────────
-- Chef/cook identity and settings.
-- Many columns added by later migrations; only base columns here.
CREATE TABLE IF NOT EXISTS cook_profiles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Identity
  display_name         TEXT,
  username             TEXT        UNIQUE,
  pronouns             TEXT        DEFAULT 'she_her',
  bio                  TEXT,
  avatar_url           TEXT,

  -- Location
  location             TEXT,
  lga                  TEXT,
  latitude             NUMERIC(10,7),
  longitude            NUMERIC(10,7),

  -- Storefront
  storefront_title     TEXT,
  storefront_bio       TEXT,
  banner_image_url     TEXT,
  kitchen_photos       TEXT[]      DEFAULT '{}',
  profile_video_url    TEXT,

  -- Social handles (stripped from public API but stored)
  instagram_handle     TEXT,
  tiktok_handle        TEXT,
  youtube_url          TEXT,
  twitter_handle       TEXT,

  -- Banking (base fields; bank_code added by 014)
  bank_name            TEXT,
  bank_account_number  TEXT,
  bank_account_name    TEXT,

  -- Schedule
  open_time_default    TEXT,
  close_time_default   TEXT,
  open_hours_by_day    JSONB,

  -- Status & verification
  is_live              BOOLEAN     NOT NULL DEFAULT false,
  is_active            BOOLEAN     NOT NULL DEFAULT true,
  is_available         BOOLEAN     NOT NULL DEFAULT true,
  is_health_kitchen    BOOLEAN     NOT NULL DEFAULT false,
  verification_status  TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (verification_status IN ('pending','approved','rejected')),
  food_safety_verified BOOLEAN     NOT NULL DEFAULT false,
  id_verified          BOOLEAN     NOT NULL DEFAULT false,
  health_certified     BOOLEAN     NOT NULL DEFAULT false,
  licensed_kitchen     BOOLEAN     NOT NULL DEFAULT false,
  professional_chef    BOOLEAN     NOT NULL DEFAULT false,
  food_safety_cert_url TEXT,
  id_doc_url           TEXT,

  -- Ratings & stats
  average_rating       NUMERIC(3,2) DEFAULT 0,
  total_orders         INTEGER      DEFAULT 0,
  repeat_order_rate    NUMERIC(5,2) DEFAULT 0,
  platform_follower_count INTEGER   DEFAULT 0,
  trust_score          NUMERIC(5,2) DEFAULT 0,

  -- Tips
  is_accepting_tips    BOOLEAN      NOT NULL DEFAULT false,

  -- Chef services
  accepts_private_chef BOOLEAN      NOT NULL DEFAULT false,
  accepts_catering     BOOLEAN      NOT NULL DEFAULT false,

  -- OTP (added formally by 040 but referenced from early code)
  -- Added here so early routes don't fail; 040 uses ADD COLUMN IF NOT EXISTS
  -- so safe to include in base.

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()

  -- Columns added by later migrations (DO NOT include here):
  --   014: bank_code
  --   020: creator_types, profile_slug, slug_updated_at, cover_image, brand_logo,
  --         brand_colors, typography_theme, social_banner
  --   022: social_oauth_data, social_verified_platforms, social_badge_tier
  --   023: bank_verified, bank_verified_at, identity_verified, identity_verified_at,
  --         reliability_score, payout_blocked, payout_blocked_reason
  --   024: health_credential_type, health_credential_number, health_credential_verified
  --   028: admin_area
  --   030: currency_code
  --   040: otp_required
);

CREATE INDEX IF NOT EXISTS idx_cook_profiles_user_id   ON cook_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_cook_profiles_username  ON cook_profiles (username);
CREATE INDEX IF NOT EXISTS idx_cook_profiles_location  ON cook_profiles (location);
CREATE INDEX IF NOT EXISTS idx_cook_profiles_status    ON cook_profiles (verification_status);
CREATE INDEX IF NOT EXISTS idx_cook_profiles_live      ON cook_profiles (is_live) WHERE is_live = true;

-- ── cook_modes ─────────────────────────────────────────────────
-- Cook operating modes (meals, realtime, private_chef, catering, etc.)
CREATE TABLE IF NOT EXISTS cook_modes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id    UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  mode       TEXT        NOT NULL,
  is_enabled BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cook_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_cook_modes_cook_id ON cook_modes (cook_id);

-- ── cook_health_specialisations ───────────────────────────────
CREATE TABLE IF NOT EXISTS cook_health_specialisations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id        UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  specialisation TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cook_id, specialisation)
  -- CHECK constraint expanded by 024_health_kitchen_v2 migration
);

CREATE INDEX IF NOT EXISTS idx_cook_health_spec_cook ON cook_health_specialisations (cook_id);

-- ── cook_discounts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cook_discounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id     UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  label       TEXT,
  discount_pct NUMERIC(5,2),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cook_discounts_cook_id ON cook_discounts (cook_id);

-- ── weekly_meal_plans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_meal_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id         UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  week_start_date DATE        NOT NULL,
  is_published    BOOLEAN     NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cook_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_meal_plans_cook ON weekly_meal_plans (cook_id);

-- ── menu_items ────────────────────────────────────────────────
-- Individual dishes posted by cooks.
CREATE TABLE IF NOT EXISTS menu_items (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id               UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  meal_plan_id          UUID        REFERENCES weekly_meal_plans(id) ON DELETE SET NULL,

  -- Identity
  title                 TEXT        NOT NULL,
  description           TEXT,
  cook_note             TEXT,
  cuisine_type          TEXT,
  ethnic_tags           TEXT[]      DEFAULT '{}',
  ingredients           TEXT[]      DEFAULT '{}',
  allergens             TEXT[]      DEFAULT '{}',
  dietary_labels        TEXT[]      DEFAULT '{}',

  -- Media
  photos                TEXT[]      NOT NULL DEFAULT '{}',
  videos                TEXT[]      DEFAULT '{}',

  -- Pricing
  unit_price            NUMERIC(12,2) NOT NULL,
  -- currency_code added by 028_schema_drift; included here as it was referenced from early routes
  -- 028 uses ADD COLUMN IF NOT EXISTS so safe to define in base
  currency_code         TEXT        NOT NULL DEFAULT 'NGN',

  -- Options / sides
  sides                 JSONB       DEFAULT '[]',

  -- Availability
  mode                  TEXT        NOT NULL DEFAULT 'meals',
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  is_today              BOOLEAN     NOT NULL DEFAULT false,   -- convenience flag used in follows query
  available_date        DATE,
  total_slots           INTEGER     NOT NULL DEFAULT 10,
  slots_claimed         INTEGER     NOT NULL DEFAULT 0,
  delivery_window_start TIMESTAMPTZ,
  delivery_window_end   TIMESTAMPTZ,

  -- Realtime (LIVE cook mode)
  realtime_available    BOOLEAN     NOT NULL DEFAULT false,
  realtime_slots        INTEGER     NOT NULL DEFAULT 0,
  realtime_slots_claimed INTEGER    NOT NULL DEFAULT 0,

  -- Special flags
  is_surprise_drop      BOOLEAN     NOT NULL DEFAULT false,
  is_gold_early_access  BOOLEAN     NOT NULL DEFAULT false,
  gold_early_access_until TIMESTAMPTZ,
  is_store_item         BOOLEAN     NOT NULL DEFAULT false,
  store_inventory       INTEGER,

  -- Source attribution
  source_post_id        UUID,       -- diary post that originated this item

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

  -- Columns added by later migrations:
  --   020: video_url, video_thumbnail, slug
  --   021: video_view_count, video_completion_count
  --   028: calories, protein_g, carbs_g, fat_g (schema drift fix)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_cook_id      ON menu_items (cook_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available    ON menu_items (available_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_meal_plan    ON menu_items (meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_mode         ON menu_items (mode, is_active);

-- ── customer_profiles ─────────────────────────────────────────
-- Extended customer profile (allergens, health preferences).
-- allergens / dietary_preferences / conditions added by 024_health_kitchen_v2.
CREATE TABLE IF NOT EXISTS customer_profiles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  allergens  TEXT[]      DEFAULT '{}',      -- 024 ADD COLUMN IF NOT EXISTS, safe to include here
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── customer_health_profiles ──────────────────────────────────
-- Health-specific customer profile (used by health kitchen routes).
-- allergens / dietary_preferences / conditions added by 024.
CREATE TABLE IF NOT EXISTS customer_health_profiles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  allergens            TEXT[]      DEFAULT '{}',
  dietary_preferences  TEXT[]      DEFAULT '{}',
  conditions           TEXT[]      DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── orders ────────────────────────────────────────────────────
-- Core order table. Many columns added by migrations 023, 025, 034, 040.
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  customer_id           UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cook_id               UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE RESTRICT,
  menu_item_id          UUID        REFERENCES menu_items(id) ON DELETE RESTRICT,

  -- Currency & type
  currency_code         TEXT        NOT NULL DEFAULT 'NGN',
  order_type            TEXT        NOT NULL DEFAULT 'preorder'
                          CHECK (order_type IN ('preorder','realtime')),

  -- Status
  status                TEXT        NOT NULL DEFAULT 'pending_payment',

  -- Quantities & pricing
  quantity              INTEGER     NOT NULL DEFAULT 1,
  unit_price            NUMERIC(12,2) NOT NULL,
  subtotal              NUMERIC(12,2) NOT NULL,
  delivery_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(12,2) NOT NULL,
  cook_payout           NUMERIC(12,2) NOT NULL,

  -- Selected options
  selected_sides        JSONB       DEFAULT '[]',
  removed_sides         JSONB       DEFAULT '[]',

  -- Delivery
  delivery_address      TEXT,
  delivery_latitude     NUMERIC(10,7),
  delivery_longitude    NUMERIC(10,7),
  delivery_window_start TIMESTAMPTZ,
  delivery_window_end   TIMESTAMPTZ,

  -- Allergen acknowledgement
  allergen_acknowledged BOOLEAN     NOT NULL DEFAULT false,
  matched_allergens     TEXT[]      DEFAULT '{}',

  -- Notes & gifting
  customer_note         TEXT,
  is_gift               BOOLEAN     NOT NULL DEFAULT false,
  gift_recipient_name   TEXT,
  gift_recipient_phone  TEXT,
  gift_message          TEXT,

  -- Subscription link
  meal_subscription_id  UUID,

  -- Payment
  flutterwave_tx_ref    TEXT,
  flutterwave_tx_id     TEXT,
  payment_method        TEXT        DEFAULT 'card',
  payout_status         TEXT        NOT NULL DEFAULT 'pending',
  payout_batch_id       UUID,

  -- Rider details (set at dispatch; used before dedicated rider_profiles)
  rider_tracking_id     TEXT,
  rider_name            TEXT,
  rider_phone           TEXT,

  -- Cook order lifecycle timestamps
  ready_photo_url       TEXT,
  ready_at              TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          TEXT        CHECK (cancelled_by IN ('customer','cook')),

  -- Refund
  refund_amount         NUMERIC(12,2),
  refund_reason         TEXT,
  refunded_at           TIMESTAMPTZ,

  -- Source attribution
  source_post_id        UUID,

  -- SLA fields (most added by 023/021 migrations; delivery_sla_minutes safe to include)
  delivery_sla_minutes  INTEGER     DEFAULT 60,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

  -- Columns added by later migrations:
  --   023: delivery_promised_at, delivery_sla_breached, dispute_window_closes_at,
  --         accepted_at, rider_assigned_at, rider_user_id
  --   025: acceptance_deadline
  --   034: delivery_provider, recipient_state, fez_order_number, fez_batch_id, fez_dispatch_status
  --   040: logistics_type, prep_time_minutes, off_platform_rider_name, off_platform_rider_phone,
  --         off_platform_eta, customer_confirmed_receipt, customer_confirmed_at,
  --         delivery_fee_payment_method, delivery_fee_paid_to_rider, delivery_fee_paid_at,
  --         otp_enabled, collection_otp, collection_otp_verified_at,
  --         delivery_otp, delivery_otp_verified_at, assigned_rider_id
  --   021: sla_deadline, is_late, late_by_minutes, fulfillment_score, fault_attribution
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id  ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_cook_id      ON orders (cook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_menu_item_id ON orders (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_orders_payout_status ON orders (payout_status);
CREATE INDEX IF NOT EXISTS idx_orders_flw_tx_ref   ON orders (flutterwave_tx_ref) WHERE flutterwave_tx_ref IS NOT NULL;

-- ── reviews ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id         UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  rating          INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT,
  photos          TEXT[]      DEFAULT '{}',
  is_visible      BOOLEAN     NOT NULL DEFAULT true,
  is_flagged      BOOLEAN     NOT NULL DEFAULT false,
  reported        BOOLEAN     NOT NULL DEFAULT false,
  report_reason   TEXT,
  cook_reply      TEXT,
  cook_replied_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_cook_id     ON reviews (cook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews (customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id    ON reviews (order_id);

-- ── tips ──────────────────────────────────────────────────────
-- Customer tips for cooks. payout_status / payout_batch_id added by 032.
CREATE TABLE IF NOT EXISTS tips (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id       UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  order_id      UUID        REFERENCES orders(id) ON DELETE SET NULL,
  amount        NUMERIC(12,2) NOT NULL,
  currency_code TEXT        NOT NULL DEFAULT 'NGN',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 032: payout_status, payout_batch_id
);

CREATE INDEX IF NOT EXISTS idx_tips_cook_id ON tips (cook_id);
CREATE INDEX IF NOT EXISTS idx_tips_customer_id ON tips (customer_id);

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  data       JSONB       DEFAULT '{}',
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON notifications (user_id, is_read) WHERE is_read = false;

-- ── follows ────────────────────────────────────────────────────
-- Customer follows a cook's kitchen.
-- notify_live added by 016_stories migration.
CREATE TABLE IF NOT EXISTS follows (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id               UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  notify_new_menu       BOOLEAN     NOT NULL DEFAULT true,
  notify_diary_post     BOOLEAN     NOT NULL DEFAULT true,
  notify_flash_sale     BOOLEAN     NOT NULL DEFAULT true,
  notify_surprise_drop  BOOLEAN     NOT NULL DEFAULT true,
  -- notify_live added by 016: ADD COLUMN IF NOT EXISTS — safe to include in base
  notify_live           BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, cook_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_customer_id ON follows (customer_id);
CREATE INDEX IF NOT EXISTS idx_follows_cook_id     ON follows (cook_id);

-- ── wallet_balances ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_balances (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_ngn  NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_balances_customer ON wallet_balances (customer_id);

-- ── wallet_transactions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('topup','debit','credit','refund')),
  amount_ngn   NUMERIC(15,2) NOT NULL,
  description  TEXT,
  ref          TEXT        UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_customer ON wallet_transactions (customer_id, created_at DESC);

-- ── payouts ────────────────────────────────────────────────────
-- Cook payout requests. bank_reference / processed_at used by admin route.
-- failure_reason added by 026; fw_transfer_id referenced in earnings.
CREATE TABLE IF NOT EXISTS payouts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id        UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  amount         NUMERIC(12,2) NOT NULL,
  currency_code  TEXT        NOT NULL DEFAULT 'NGN',
  type           TEXT        NOT NULL DEFAULT 'standard'
                   CHECK (type IN ('standard','instant')),
  instant_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','completed','failed')),
  fw_transfer_id TEXT,
  bank_reference TEXT,
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 026: failure_reason
);

CREATE INDEX IF NOT EXISTS idx_payouts_cook_id ON payouts (cook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status  ON payouts (status);

-- ── cook_savings ──────────────────────────────────────────────
-- Savings pool for cooks (referenced in earnings route).
CREATE TABLE IF NOT EXISTS cook_savings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id      UUID        NOT NULL UNIQUE REFERENCES cook_profiles(id) ON DELETE CASCADE,
  balance      NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── loyalty_points ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_points (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance          INTEGER     NOT NULL DEFAULT 0,
  lifetime_earned  INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── loyalty_transactions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('earned','redeemed','expired')),
  points       INTEGER     NOT NULL,
  description  TEXT,
  order_id     UUID        REFERENCES orders(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions (customer_id, created_at DESC);

-- ── cook_diary_posts ──────────────────────────────────────────
-- Cook's diary/feed posts. is_pinned added by 031; video fields by 020; view tracking by 021.
CREATE TABLE IF NOT EXISTS cook_diary_posts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id        UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  title          TEXT,
  body           TEXT,
  photo_url      TEXT,
  photo_urls     TEXT[]      DEFAULT '{}',
  post_type      TEXT        NOT NULL DEFAULT 'kitchen_story'
                   CHECK (post_type IN ('dish_reveal','kitchen_story','behind_the_scenes','flash_sale','weekly_menu')),
  status         TEXT        NOT NULL DEFAULT 'published'
                   CHECK (status IN ('draft','scheduled','published','flagged')),
  scheduled_at   TIMESTAMPTZ,
  linked_item_id UUID        REFERENCES menu_items(id) ON DELETE SET NULL,
  share_count    INTEGER     NOT NULL DEFAULT 0,
  view_count     INTEGER     NOT NULL DEFAULT 0,
  -- is_pinned added by 031 — ADD COLUMN IF NOT EXISTS, safe to include here
  is_pinned      BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by later migrations:
  --   020: video_url, video_thumbnail, video_duration
  --   021: video_view_count, video_completion_count
  --   031: is_pinned (included above for completeness)
);

CREATE INDEX IF NOT EXISTS idx_diary_posts_cook_id ON cook_diary_posts (cook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_posts_status  ON cook_diary_posts (status, created_at DESC);

-- ── diary_comments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  mentions   JSONB       DEFAULT '[]',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_comments_post_id ON diary_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_diary_comments_user_id ON diary_comments (user_id);

-- ── post_bookmarks ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_bookmarks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID        NOT NULL REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user ON post_bookmarks (user_id);

-- ── post_shares ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_shares (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID        NOT NULL REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  platform   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares (post_id);

-- ── cook_community_posts ───────────────────────────────────────
-- Cook-to-cook community forum.
CREATE TABLE IF NOT EXISTS cook_community_posts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id    UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  photo_urls TEXT[]      DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_cook     ON cook_community_posts (cook_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON cook_community_posts (category, created_at DESC);

-- ── cook_community_replies ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS cook_community_replies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES cook_community_posts(id) ON DELETE CASCADE,
  cook_id    UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_replies_post ON cook_community_replies (post_id, created_at ASC);

-- ── chop_talk_posts ────────────────────────────────────────────
-- Customer-to-cook community wall (requires ≥1 delivered order).
CREATE TABLE IF NOT EXISTS chop_talk_posts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id               UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  customer_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body                  TEXT        NOT NULL,
  photo_urls            TEXT[]      DEFAULT '{}',
  order_count_with_cook INTEGER     NOT NULL DEFAULT 0,
  is_milestone          BOOLEAN     NOT NULL DEFAULT false,
  is_pinned             BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chop_talk_posts_cook     ON chop_talk_posts (cook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chop_talk_posts_customer ON chop_talk_posts (customer_id);

-- ── chop_talk_replies ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chop_talk_replies (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        UUID        NOT NULL REFERENCES chop_talk_posts(id) ON DELETE CASCADE,
  author_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body           TEXT        NOT NULL,
  is_cook_reply  BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chop_talk_replies_post ON chop_talk_replies (post_id, created_at ASC);

-- ── escrow_holds ───────────────────────────────────────────────
-- Escrow for orders, chef bookings, catering.
-- hold_reason / dispute_window_active / bank_verified added by 023.
-- auto_release_at / escrow_type / source_id added by 021b.
CREATE TABLE IF NOT EXISTS escrow_holds (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID        REFERENCES orders(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  currency_code  TEXT        NOT NULL DEFAULT 'NGN',
  status         TEXT        NOT NULL DEFAULT 'held'
                   CHECK (status IN ('held','released','refunded','partial_refund')),
  refund_amount  NUMERIC(12,2),
  payout_blocked BOOLEAN     NOT NULL DEFAULT false,
  released_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 023: hold_reason, dispute_window_active, bank_verified
  -- Columns added by 021b: auto_release_at, escrow_type, source_id
);

CREATE INDEX IF NOT EXISTS idx_escrow_holds_order  ON escrow_holds (order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_status ON escrow_holds (status);

-- ── disputes ───────────────────────────────────────────────────
-- Customer disputes against orders.
-- fault_attribution / penalty_type / penalty_applied_at added by 021b.
-- sla_deadline referenced in admin route.
CREATE TABLE IF NOT EXISTS disputes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id         UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  reason          TEXT        NOT NULL,
  description     TEXT,
  evidence_urls   TEXT[]      DEFAULT '{}',
  status          TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','escalated','resolved','closed')),
  resolution      TEXT,
  resolution_type TEXT        CHECK (resolution_type IN ('full_refund','partial_refund','no_refund')),
  refund_amount   NUMERIC(12,2),
  admin_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  sla_deadline    TIMESTAMPTZ,
  escalated_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 021b: fault_attribution, penalty_type, penalty_applied_at
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id     ON disputes (order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer_id  ON disputes (customer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_cook_id      ON disputes (cook_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status       ON disputes (status);

-- ── verification_submissions ───────────────────────────────────
-- Cook submits docs for admin review. Referenced in admin.js.
CREATE TABLE IF NOT EXISTS verification_submissions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id      UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  doc_type     TEXT        NOT NULL,
  doc_url      TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  review_notes TEXT,
  expires_at   DATE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_verif_submissions_cook   ON verification_submissions (cook_id);
CREATE INDEX IF NOT EXISTS idx_verif_submissions_status ON verification_submissions (status, submitted_at ASC);

-- ── country_config ─────────────────────────────────────────────
-- Platform config per country (currency, fee rates, etc.).
CREATE TABLE IF NOT EXISTS country_config (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code     TEXT        NOT NULL UNIQUE,
  country_name     TEXT        NOT NULL,
  currency_code    TEXT        NOT NULL DEFAULT 'NGN',
  currency_symbol  TEXT        NOT NULL DEFAULT '₦',
  platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 3.75,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── admin_actions ──────────────────────────────────────────────
-- Audit log for admin actions (suspend/reinstate, etc.).
CREATE TABLE IF NOT EXISTS admin_actions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type   TEXT        NOT NULL,
  target_id     UUID        NOT NULL,
  action        TEXT        NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_user_id, target_type, target_id, action)
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions (target_type, target_id);

-- ── courses ────────────────────────────────────────────────────
-- Cooking courses sold by creator cooks.
-- is_published / promo_video_url (020) / slug (020) / certificates (021b) added later.
CREATE TABLE IF NOT EXISTS courses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id          UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT,
  cover_image_url  TEXT,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code    TEXT        NOT NULL DEFAULT 'NGN',
  is_published     BOOLEAN     NOT NULL DEFAULT false,
  duration_minutes INTEGER,
  lesson_count     INTEGER     DEFAULT 0,
  student_count    INTEGER     DEFAULT 0,
  average_rating   NUMERIC(3,2) DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 020: promo_video_url, slug
  -- Columns added by 027 trgm: idx on title
);

CREATE INDEX IF NOT EXISTS idx_courses_cook_id    ON courses (cook_id);
CREATE INDEX IF NOT EXISTS idx_courses_published  ON courses (is_published, created_at DESC);

-- ── course_lessons ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_lessons (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  description   TEXT,
  video_url     TEXT,
  duration_seconds INTEGER,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  is_free_preview BOOLEAN   NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_course ON course_lessons (course_id, sort_order ASC);

-- ── course_enrollments ─────────────────────────────────────────
-- Student enrolment in a course.
-- progress_pct / lessons_completed / completed_at / certificate columns added by 021b.
CREATE TABLE IF NOT EXISTS course_enrollments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_ref  TEXT,
  amount_paid  NUMERIC(12,2),
  enrolled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, user_id)
  -- Columns added by 021b: progress_pct, lessons_completed, completed_at,
  --   certificate_issued, certificate_url, certificate_issued_at
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_user   ON course_enrollments (user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON course_enrollments (course_id);

-- ── digital_products ───────────────────────────────────────────
-- e-books, PDF guides, templates sold by creators.
-- slug / preview_video_url added by 020.
CREATE TABLE IF NOT EXISTS digital_products (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id          UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT,
  cover_image_url  TEXT,
  file_url         TEXT,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code    TEXT        NOT NULL DEFAULT 'NGN',
  is_published     BOOLEAN     NOT NULL DEFAULT false,
  product_type     TEXT        DEFAULT 'ebook',
  download_count   INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 020: slug, preview_video_url
);

CREATE INDEX IF NOT EXISTS idx_digital_products_cook ON digital_products (cook_id);

-- ── weekly_menus ───────────────────────────────────────────────
-- Curated weekly menus published by cooks.
-- slug added by 020.
CREATE TABLE IF NOT EXISTS weekly_menus (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id         UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  title           TEXT,
  week_start_date DATE,
  is_published    BOOLEAN     NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 020: slug
);

CREATE INDEX IF NOT EXISTS idx_weekly_menus_cook ON weekly_menus (cook_id);

-- ── private_chef_bookings ──────────────────────────────────────
-- Private chef booking requests.
-- deposit / SLA columns added by 023; deposit_platform_fee by 039.
CREATE TABLE IF NOT EXISTS private_chef_bookings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id         UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  customer_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type      TEXT,
  guest_count     INTEGER,
  event_date      DATE,
  event_time      TEXT,
  location        TEXT,
  dietary_notes   TEXT,
  budget          NUMERIC(12,2),
  currency_code   TEXT        NOT NULL DEFAULT 'NGN',
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
  cook_note       TEXT,
  payment_ref     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 023: deposit_amount, deposit_percentage, deposit_paid, deposit_paid_at,
  --   deposit_tx_ref, final_amount, final_paid, final_paid_at,
  --   completion_confirmed_by_customer, review_window_closes_at, sla_deadline, sla_breached
  -- Columns added by 039: deposit_platform_fee
);

CREATE INDEX IF NOT EXISTS idx_private_chef_cook      ON private_chef_bookings (cook_id);
CREATE INDEX IF NOT EXISTS idx_private_chef_customer  ON private_chef_bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_private_chef_status    ON private_chef_bookings (status);

-- ── chef_availability ──────────────────────────────────────────
-- Chef availability calendar (daily). start/end/cap columns added by 021b.
CREATE TABLE IF NOT EXISTS chef_availability (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id     UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  is_available BOOLEAN    NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cook_id, date)
  -- Columns added by 021b: start_time, end_time, max_bookings, is_vacation, is_blackout
);

CREATE INDEX IF NOT EXISTS idx_chef_availability_cook ON chef_availability (cook_id, date ASC);

-- ── catering_events ────────────────────────────────────────────
-- Catering requests / events. cook_id made nullable by 038 (open marketplace).
-- event_tag added by 021b; deposit_platform_fee by 039.
CREATE TABLE IF NOT EXISTS catering_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id          UUID        REFERENCES cook_profiles(id) ON DELETE SET NULL,
  event_type       TEXT,
  guest_count      INTEGER,
  event_date       DATE,
  event_time       TEXT,
  location         TEXT,
  budget           NUMERIC(12,2),
  currency_code    TEXT        NOT NULL DEFAULT 'NGN',
  menu_notes       TEXT,
  dietary_notes    TEXT,
  status           TEXT        NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','matched','accepted','rejected','completed','cancelled')),
  deposit_amount   NUMERIC(12,2),
  deposit_paid     BOOLEAN     NOT NULL DEFAULT false,
  deposit_paid_at  TIMESTAMPTZ,
  deposit_tx_ref   TEXT,
  total_price      NUMERIC(12,2),
  is_public        BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- cook_id made nullable by 038_catering_marketplace
  -- Columns added by 021b: event_tag
  -- Columns added by 039: deposit_platform_fee
);

CREATE INDEX IF NOT EXISTS idx_catering_events_customer ON catering_events (customer_id);
CREATE INDEX IF NOT EXISTS idx_catering_events_cook     ON catering_events (cook_id);
CREATE INDEX IF NOT EXISTS idx_catering_events_status   ON catering_events (status);

-- ── custom_requests ────────────────────────────────────────────
-- Bespoke order requests (negotiate price/spec directly).
-- delivery_date / quantity / revision_count / quote_versions / negotiation_notes / escrow_hold_id
-- added by 021b.
CREATE TABLE IF NOT EXISTS custom_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id         UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  title           TEXT,
  description     TEXT        NOT NULL,
  budget          NUMERIC(12,2),
  currency_code   TEXT        NOT NULL DEFAULT 'NGN',
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','quoted','accepted','rejected','completed','cancelled')),
  quoted_price    NUMERIC(12,2),
  payment_ref     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 021b: delivery_date, quantity, revision_count, quote_versions,
  --   negotiation_notes, escrow_hold_id
);

CREATE INDEX IF NOT EXISTS idx_custom_requests_customer ON custom_requests (customer_id);
CREATE INDEX IF NOT EXISTS idx_custom_requests_cook     ON custom_requests (cook_id);

-- ── meal_subscriptions ─────────────────────────────────────────
-- Recurring meal subscription plans.
CREATE TABLE IF NOT EXISTS meal_subscriptions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id           UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  plan_type         TEXT        NOT NULL DEFAULT 'weekly',
  meals_per_week    INTEGER     NOT NULL DEFAULT 5,
  currency_code     TEXT        NOT NULL DEFAULT 'NGN',
  price_per_week    NUMERIC(12,2),
  status            TEXT        NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paused','cancelled')),
  next_billing_date DATE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_subs_customer ON meal_subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_meal_subs_cook     ON meal_subscriptions (cook_id);

-- ── analytics_events ───────────────────────────────────────────
-- Raw event log for the analytics service.
CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT        NOT NULL,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  cook_id     UUID        REFERENCES cook_profiles(id) ON DELETE SET NULL,
  item_id     UUID,
  order_id    UUID,
  properties  JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name    ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user    ON analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_cook    ON analytics_events (cook_id, created_at DESC);

-- ── db_migrations ─────────────────────────────────────────────
-- Migration tracking table (used by the migration runner).
CREATE TABLE IF NOT EXISTS db_migrations (
  id          SERIAL      PRIMARY KEY,
  filename    TEXT        NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Tables introduced by migrations 013–016 that are referenced
-- across all route files and thus belong in any full base deploy.
-- They were added by numbered migrations but the routes already
-- use them unconditionally, so the base schema must include them.
-- ═══════════════════════════════════════════════════════════════

-- ── likes (013) ────────────────────────────────────────────────
-- Polymorphic likes for diary posts, menu items, comments.
-- target_type constraint expanded by later routes (comment added).
CREATE TABLE IF NOT EXISTS likes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL,
  target_id   UUID        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_target ON likes (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_likes_user   ON likes (user_id);

-- ── cravings (013) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cravings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_item_id          UUID        REFERENCES menu_items(id) ON DELETE CASCADE,
  cook_id               UUID        REFERENCES cook_profiles(id) ON DELETE SET NULL,
  dish_title            TEXT        NOT NULL,
  dish_price            NUMERIC(12,2),
  dish_photo            TEXT,
  currency_code         TEXT        NOT NULL DEFAULT 'NGN',
  notes                 TEXT,
  is_public             BOOLEAN     NOT NULL DEFAULT true,
  is_fulfilled          BOOLEAN     NOT NULL DEFAULT false,
  fulfilled_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at          TIMESTAMPTZ,
  cook_notify           BOOLEAN     NOT NULL DEFAULT false,
  public_shown_this_week INTEGER    NOT NULL DEFAULT 0,
  public_shown_week_start DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_cravings_user   ON cravings (user_id);
CREATE INDEX IF NOT EXISTS idx_cravings_cook   ON cravings (cook_id);
CREATE INDEX IF NOT EXISTS idx_cravings_public ON cravings (user_id, is_public);

-- ── push_tokens (013) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  platform   TEXT        NOT NULL DEFAULT 'unknown',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens (user_id);

-- ── stories (016) ─────────────────────────────────────────────
-- 24-hour expiry cook stories / LIVE markers.
-- video fields added by 020.
CREATE TABLE IF NOT EXISTS stories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id     UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL
                CHECK (type IN ('cooking_now','available_today','sold_out','flash_sale','live')),
  media_url   TEXT,
  media_type  TEXT        CHECK (media_type IN ('photo','video')),
  caption     TEXT,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  view_count  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Columns added by 020: video_url, video_thumbnail, is_video
);

CREATE INDEX IF NOT EXISTS idx_stories_cook_id ON stories (cook_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories (expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_active  ON stories (is_active, expires_at) WHERE is_active = true;

-- ── story_views (016) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  story_id   UUID        NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_viewer ON story_views (viewer_id);

-- ── social_identities (035) ────────────────────────────────────
-- OAuth identity links (Google, Apple).
CREATE TABLE IF NOT EXISTS social_identities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT        NOT NULL CHECK (provider IN ('google','apple')),
  provider_id TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_social_identities_user ON social_identities (user_id);

-- ══════════════════════════════════════════════════════════════
-- DB functions referenced by routes
-- ══════════════════════════════════════════════════════════════

-- claim_slot: atomically increment slots_claimed and return true if slots remain
CREATE OR REPLACE FUNCTION claim_slot(item_id UUID, qty INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE menu_items
  SET slots_claimed = slots_claimed + qty
  WHERE id = item_id
    AND (total_slots - slots_claimed) >= qty
    AND is_active = true;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- claim_realtime_slot: same for realtime orders
CREATE OR REPLACE FUNCTION claim_realtime_slot(item_id UUID, qty INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE menu_items
  SET realtime_slots_claimed = realtime_slots_claimed + qty
  WHERE id = item_id
    AND (realtime_slots - realtime_slots_claimed) >= qty
    AND realtime_available = true
    AND is_active = true;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;
