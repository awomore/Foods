-- ============================================================
-- FOODS Phase 6 — Platform Convergence
-- Migration 020_phase6.sql
-- ============================================================

-- ── PART A: Creator Identity ─────────────────────────────────
-- Multi-type creator system: replace "cook" assumption with typed creator identities

ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS creator_types   TEXT[]    DEFAULT '{"home_cook"}',
  ADD COLUMN IF NOT EXISTS profile_slug    TEXT      UNIQUE,
  ADD COLUMN IF NOT EXISTS slug_updated_at TIMESTAMPTZ;

-- Unique index on slug for fast deep-link lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_cook_profiles_slug
  ON cook_profiles (profile_slug)
  WHERE profile_slug IS NOT NULL;

-- ── PART B: Creator Branding ─────────────────────────────────
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS cover_image       TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo        TEXT,
  ADD COLUMN IF NOT EXISTS brand_colors      JSONB DEFAULT '{"primary":"#C97A35","secondary":"#1A1009","accent":"#FAF6F0"}',
  ADD COLUMN IF NOT EXISTS typography_theme  TEXT  DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS social_banner     TEXT;

-- ── PART D: Video everywhere ─────────────────────────────────
-- Add video_url + video_thumbnail to menu_items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS video_url       TEXT,
  ADD COLUMN IF NOT EXISTS video_thumbnail TEXT;

-- Add video to cook_diary_posts
ALTER TABLE cook_diary_posts
  ADD COLUMN IF NOT EXISTS video_url       TEXT,
  ADD COLUMN IF NOT EXISTS video_thumbnail TEXT,
  ADD COLUMN IF NOT EXISTS video_duration  INTEGER; -- seconds

-- Add video to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS promo_video_url TEXT;

-- Add video to digital_products
ALTER TABLE digital_products
  ADD COLUMN IF NOT EXISTS preview_video_url TEXT;

-- Add video to stories
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS video_url       TEXT,
  ADD COLUMN IF NOT EXISTS video_thumbnail TEXT,
  ADD COLUMN IF NOT EXISTS is_video        BOOLEAN DEFAULT false;

-- ── PART E: Deep Link slugs ──────────────────────────────────
-- Unique slugs for dishes, courses, products, services
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_slug
  ON menu_items (slug) WHERE slug IS NOT NULL;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_slug
  ON courses (slug) WHERE slug IS NOT NULL;

ALTER TABLE digital_products
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_digital_products_slug
  ON digital_products (slug) WHERE slug IS NOT NULL;

ALTER TABLE weekly_menus
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_menus_slug
  ON weekly_menus (slug) WHERE slug IS NOT NULL;

-- ── PART I: Search history + trending ───────────────────────
CREATE TABLE IF NOT EXISTS search_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  query       TEXT        NOT NULL,
  result_type TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user
  ON search_history (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search_trending (
  query       TEXT        PRIMARY KEY,
  count       INTEGER     DEFAULT 1,
  last_seen   TIMESTAMPTZ DEFAULT now()
);

-- Auto-upsert function for trending
CREATE OR REPLACE FUNCTION upsert_trending_search(q TEXT) RETURNS void AS $$
BEGIN
  INSERT INTO search_trending (query, count, last_seen)
  VALUES (lower(trim(q)), 1, now())
  ON CONFLICT (query) DO UPDATE
    SET count = search_trending.count + 1,
        last_seen = now();
END;
$$ LANGUAGE plpgsql;

-- ── PART J: Customer video posts ─────────────────────────────
CREATE TABLE IF NOT EXISTS customer_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT,
  photo_urls      TEXT[]      DEFAULT '{}',
  video_url       TEXT,
  video_thumbnail TEXT,
  tagged_cook_ids UUID[]      DEFAULT '{}',
  mention_user_ids UUID[]     DEFAULT '{}',
  order_id        UUID        REFERENCES orders(id) ON DELETE SET NULL,
  like_count      INTEGER     DEFAULT 0,
  comment_count   INTEGER     DEFAULT 0,
  repost_count    INTEGER     DEFAULT 0,
  status          TEXT        DEFAULT 'published',  -- published, removed
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_posts_user
  ON customer_posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_posts_tagged_cook
  ON customer_posts USING GIN (tagged_cook_ids);

-- Allow creators to repost customer content
CREATE TABLE IF NOT EXISTS customer_post_reposts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        UUID        NOT NULL REFERENCES customer_posts(id) ON DELETE CASCADE,
  cook_id        UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  reposted_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, cook_id)
);

-- Like/unlike customer posts
CREATE TABLE IF NOT EXISTS customer_post_likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES customer_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ── FTS indexes on new tables ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customer_posts_fts
  ON customer_posts USING GIN (
    to_tsvector('english', coalesce(body, ''))
  );

-- Index for creator type filtering
CREATE INDEX IF NOT EXISTS idx_cook_profiles_creator_types
  ON cook_profiles USING GIN (creator_types);

-- ── Home feed discovery views ────────────────────────────────
-- View: creators currently live
DROP VIEW IF EXISTS creators_live_now;
CREATE VIEW creators_live_now AS
  SELECT cp.id, cp.display_name, u.avatar_url, cp.profile_slug,
         cp.creator_types, cp.average_rating
  FROM cook_profiles cp
  JOIN users u ON u.id = cp.user_id
  WHERE cp.is_live = true AND cp.verification_status = 'approved';

-- View: trending creators (most orders in last 7 days)
DROP VIEW IF EXISTS creators_trending;
CREATE VIEW creators_trending AS
  SELECT cp.id, cp.display_name, u.avatar_url, cp.profile_slug,
         cp.creator_types, cp.average_rating,
         COUNT(o.id) AS recent_orders
  FROM cook_profiles cp
  JOIN users u ON u.id = cp.user_id
  LEFT JOIN orders o ON o.cook_id = cp.id
    AND o.created_at > now() - INTERVAL '7 days'
    AND o.status NOT IN ('cancelled')
  WHERE cp.verification_status = 'approved'
  GROUP BY cp.id, u.avatar_url
  ORDER BY recent_orders DESC;
