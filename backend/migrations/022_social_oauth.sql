-- ============================================================
-- FOODS 022 — Social OAuth verification columns
-- ============================================================

-- Per-platform OAuth verification data (JSONB keyed by platform name)
-- e.g. { "youtube": { "channel_id": "UCxxx", "handle": "@chef", "subscribers": 12400, "verified_at": "..." } }
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS social_oauth_data        JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_verified_platforms TEXT[]  DEFAULT '{}';

-- Verification badge tier, recomputed on each OAuth sync
-- Values: 'creator' | 'rising' | 'established' | 'elite'
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS social_badge_tier TEXT;
