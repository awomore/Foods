-- ── Schema drift fixes ───────────────────────────────────────────────────────
-- Columns that routes already reference but no migration ever created.
-- PATCH /cooks/:id updates admin_area; POST /menu inserts currency_code;
-- GET /health/feeding-history selects nutrition fields off menu_items.

ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS admin_area TEXT;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS calories  INTEGER,
  ADD COLUMN IF NOT EXISTS protein_g NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS carbs_g   NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS fat_g     NUMERIC(6,1);
