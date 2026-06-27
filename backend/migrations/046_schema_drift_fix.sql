-- 046_schema_drift_fix.sql
-- Fix three schema gaps causing recurring scheduler errors:
--   1. platform_settings table missing entirely
--   2. orders.cancel_reason column missing
--   3. orders.cancelled_by CHECK excludes 'system' (scheduler sets this)
--   4. stories.media_cloudinary_id column missing

-- ── 1. platform_settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO platform_settings (key, value) VALUES
  ('commission_rate',                '0.0375'),
  ('cook_went_dark_minutes',         '90'),
  ('realtime_confirm_minutes',       '15'),
  ('flash_sale_slots_threshold',     '3'),
  ('flash_sale_minutes_before_close','90')
ON CONFLICT (key) DO NOTHING;

-- ── 2. orders.cancel_reason ─────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- ── 3. Fix cancelled_by CHECK to allow 'system' ─────────────────
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_cancelled_by_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_cancelled_by_check
  CHECK (cancelled_by IN ('customer', 'cook', 'system'));

-- ── 4. stories.media_cloudinary_id ──────────────────────────────
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS media_cloudinary_id TEXT;
