DROP INDEX IF EXISTS idx_cook_profiles_live_started;
ALTER TABLE cook_profiles DROP CONSTRAINT IF EXISTS cook_profiles_live_platform_check;
ALTER TABLE cook_profiles
  DROP COLUMN IF EXISTS live_platform,
  DROP COLUMN IF EXISTS live_started_at;
