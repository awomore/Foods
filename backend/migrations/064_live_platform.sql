-- Live status gains a destination and a start time.
--
-- Neither TikTok nor Instagram exposes "is this creator live right now" to third
-- parties, so live-ness cannot be detected — only declared. live_platform is that
-- declaration: NULL means "my kitchen is open" (no video is promised), and a value
-- means "I am streaming there", which is what earns a watch link.
--
-- live_started_at exists so a forgotten toggle can be swept. Before this, the only
-- automatic clear was NAFDAC auto-suspension, so a cook who forgot stayed top-ranked
-- and in the live rail indefinitely with a closed kitchen.

ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS live_platform   TEXT,
  ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ;

ALTER TABLE cook_profiles
  DROP CONSTRAINT IF EXISTS cook_profiles_live_platform_check;
ALTER TABLE cook_profiles
  ADD CONSTRAINT cook_profiles_live_platform_check
  CHECK (live_platform IS NULL OR live_platform IN ('tiktok', 'instagram'));

-- Anyone already flagged live has no start time, which would make them permanently
-- immune to the staleness sweep. Treat the migration as their start.
UPDATE cook_profiles
   SET live_started_at = NOW()
 WHERE is_live = true AND live_started_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cook_profiles_live_started
  ON cook_profiles (live_started_at) WHERE is_live = true;
