-- Migration 021: track Cloudinary public_id on stories for cleanup
-- Allows the scheduler to DELETE expired story media from Cloudinary
-- rather than leaving orphaned assets consuming quota forever.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS media_cloudinary_id text;

CREATE INDEX IF NOT EXISTS stories_cleanup_idx
  ON stories (expires_at, media_cloudinary_id)
  WHERE is_active = false AND media_cloudinary_id IS NOT NULL;
