-- ── 015: Creator Content System ─────────────────────────────────────────────
-- Extends cook_diary_posts with post types, scheduling, multi-photo, CTA linking.
-- Adds post_bookmarks, post_shares tables and order attribution.

-- Extend cook_diary_posts
ALTER TABLE cook_diary_posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'kitchen_story'
    CHECK (post_type IN ('dish_reveal','kitchen_story','behind_the_scenes','flash_sale','weekly_menu')),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','scheduled','published')),
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title text;

-- Bookmarks (customers save posts for later)
CREATE TABLE IF NOT EXISTS post_bookmarks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Share logs (track when/what platform a post was shared from)
CREATE TABLE IF NOT EXISTS post_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  post_id    uuid NOT NULL REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  platform   text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Order attribution: track which post drove an order
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source_post_id uuid REFERENCES cook_diary_posts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_user    ON post_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_post    ON post_bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_post       ON post_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_diary_status_sched     ON cook_diary_posts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_diary_cook_status      ON cook_diary_posts(cook_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_source_post     ON orders(source_post_id) WHERE source_post_id IS NOT NULL;
