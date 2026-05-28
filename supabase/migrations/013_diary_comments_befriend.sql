-- Diary comments with @mentions
CREATE TABLE IF NOT EXISTS diary_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES cook_diary_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (length(body) <= 500),
  mentions    JSONB DEFAULT '[]'::jsonb,  -- array of {type:'user'|'cook', id, username}
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_comments_post ON diary_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_diary_comments_user ON diary_comments(user_id);

-- Add username to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0;

-- Unique username constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

-- Friends/connections table (shared table befriend)
CREATE TABLE IF NOT EXISTS user_connections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  shared_order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- order that introduced them
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_requester ON user_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_recipient ON user_connections(recipient_id);

-- Allow comment likes in existing likes table (target_type already TEXT)
-- Already supported by the likes table structure.
