-- ============================================================
-- DOWN: Revert 020_phase6.sql
-- ============================================================

DROP VIEW IF EXISTS creators_trending;
DROP VIEW IF EXISTS creators_live_now;

DROP FUNCTION IF EXISTS upsert_trending_search(TEXT);

DROP TABLE IF EXISTS customer_post_reposts;
DROP TABLE IF EXISTS customer_post_likes;
DROP TABLE IF EXISTS customer_posts;
DROP TABLE IF EXISTS search_trending;
DROP TABLE IF EXISTS search_history;

DROP INDEX IF EXISTS idx_cook_profiles_creator_types;
DROP INDEX IF EXISTS idx_customer_posts_fts;
DROP INDEX IF EXISTS idx_customer_posts_tagged_cook;
DROP INDEX IF EXISTS idx_customer_posts_user;
DROP INDEX IF EXISTS idx_search_history_user;
DROP INDEX IF EXISTS idx_weekly_menus_slug;
DROP INDEX IF EXISTS idx_digital_products_slug;
DROP INDEX IF EXISTS idx_courses_slug;
DROP INDEX IF EXISTS idx_menu_items_slug;
DROP INDEX IF EXISTS idx_cook_profiles_slug;

ALTER TABLE cook_profiles
  DROP COLUMN IF EXISTS creator_types,
  DROP COLUMN IF EXISTS profile_slug,
  DROP COLUMN IF EXISTS slug_updated_at,
  DROP COLUMN IF EXISTS cover_image,
  DROP COLUMN IF EXISTS brand_logo,
  DROP COLUMN IF EXISTS brand_colors,
  DROP COLUMN IF EXISTS typography_theme,
  DROP COLUMN IF EXISTS social_banner;

ALTER TABLE menu_items
  DROP COLUMN IF EXISTS video_url,
  DROP COLUMN IF EXISTS video_thumbnail,
  DROP COLUMN IF EXISTS slug;

ALTER TABLE cook_diary_posts
  DROP COLUMN IF EXISTS video_url,
  DROP COLUMN IF EXISTS video_thumbnail,
  DROP COLUMN IF EXISTS video_duration;

ALTER TABLE courses
  DROP COLUMN IF EXISTS promo_video_url,
  DROP COLUMN IF EXISTS slug;

ALTER TABLE digital_products
  DROP COLUMN IF EXISTS preview_video_url,
  DROP COLUMN IF EXISTS slug;

ALTER TABLE stories
  DROP COLUMN IF EXISTS video_url,
  DROP COLUMN IF EXISTS video_thumbnail,
  DROP COLUMN IF EXISTS is_video;

ALTER TABLE weekly_menus
  DROP COLUMN IF EXISTS slug;
