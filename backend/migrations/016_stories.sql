-- Migration 016: Stories system
-- 24-hour expiry, photo/video media, story rings, LIVE auto-story

CREATE TABLE IF NOT EXISTS stories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id     uuid NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('cooking_now', 'available_today', 'sold_out', 'flash_sale', 'live')),
  media_url   text,
  media_type  text CHECK (media_type IN ('photo', 'video')),
  caption     text,
  expires_at  timestamptz NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  is_active   boolean DEFAULT true,
  view_count  int DEFAULT 0,
  created_at  timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stories_cook_id_idx   ON stories (cook_id);
CREATE INDEX IF NOT EXISTS stories_expires_idx   ON stories (expires_at);
CREATE INDEX IF NOT EXISTS stories_active_idx    ON stories (is_active, expires_at) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS story_views (
  story_id   uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  viewed_at  timestamptz DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS story_views_viewer_idx ON story_views (viewer_id);

-- notify_live preference on the follows table
ALTER TABLE follows ADD COLUMN IF NOT EXISTS notify_live boolean DEFAULT true;
