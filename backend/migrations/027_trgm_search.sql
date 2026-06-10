-- ============================================================
-- 027_trgm_search.sql — pg_trgm trigram indexes for fuzzy search
-- ============================================================

-- Enable the trigram extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Cook display names — powers fuzzy name search
CREATE INDEX IF NOT EXISTS idx_cook_profiles_trgm_name
  ON cook_profiles USING GIN (display_name gin_trgm_ops)
  WHERE verification_status = 'approved';

-- Menu item titles
CREATE INDEX IF NOT EXISTS idx_menu_items_trgm_title
  ON menu_items USING GIN (title gin_trgm_ops)
  WHERE is_active = true;

-- Course titles
CREATE INDEX IF NOT EXISTS idx_courses_trgm_title
  ON courses USING GIN (title gin_trgm_ops)
  WHERE is_published = true;

-- Digital product titles
CREATE INDEX IF NOT EXISTS idx_digital_products_trgm_title
  ON digital_products USING GIN (title gin_trgm_ops);
