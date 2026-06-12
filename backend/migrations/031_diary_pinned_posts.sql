-- Add is_pinned flag to diary posts (max 3 per cook, enforced at app layer)
ALTER TABLE cook_diary_posts
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_diary_posts_pinned
  ON cook_diary_posts (cook_id, is_pinned)
  WHERE is_pinned = TRUE;
