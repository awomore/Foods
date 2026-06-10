-- ============================================================
-- DOWN: Revert 022_social_oauth.sql
-- ============================================================

ALTER TABLE cook_profiles
  DROP COLUMN IF EXISTS social_oauth_data,
  DROP COLUMN IF EXISTS social_verified_platforms,
  DROP COLUMN IF EXISTS social_badge_tier;
