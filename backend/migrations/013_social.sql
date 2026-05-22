-- Migration 013: likes (polymorphic) + cravings tables

CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('diary_post', 'menu_item', 'chop_talk_post')),
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS likes_target_idx ON likes (target_type, target_id);
CREATE INDEX IF NOT EXISTS likes_user_idx ON likes (user_id);

CREATE TABLE IF NOT EXISTS cravings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  cook_id uuid REFERENCES cook_profiles(id) ON DELETE SET NULL,
  dish_title text NOT NULL,
  dish_price numeric,
  dish_photo text,
  currency_code text DEFAULT 'NGN',
  notes text,
  is_public boolean DEFAULT true,
  is_fulfilled boolean DEFAULT false,
  fulfilled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  cook_notify boolean DEFAULT false,
  public_shown_this_week int DEFAULT 0,
  public_shown_week_start date,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(user_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS cravings_user_idx ON cravings (user_id);
CREATE INDEX IF NOT EXISTS cravings_public_idx ON cravings (user_id, is_public);
CREATE INDEX IF NOT EXISTS cravings_cook_idx ON cravings (cook_id);

-- Push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'unknown',
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON push_tokens (user_id);
