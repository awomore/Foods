-- ============================================================
-- FOODSbyme Migration 006: reviews, follows, notifications, social
-- ============================================================

-- Reviews (requires delivered order + at least 1 photo)
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) UNIQUE NOT NULL,
  customer_id uuid REFERENCES users(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body text,
  photos text[],                          -- at least 1 required
  cook_reply text,
  cook_replied_at timestamptz,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Follows (customer follows cook)
CREATE TABLE follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  -- Notification preferences per follow
  notify_new_menu boolean DEFAULT true,
  notify_diary_post boolean DEFAULT true,
  notify_flash_sale boolean DEFAULT true,
  notify_surprise_drop boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (customer_id, cook_id)
);

-- Notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  type text NOT NULL,
  -- Types: new_order, order_confirmed, order_ready, rider_dispatched, delivered,
  -- review_prompt, custom_request_quote, payout_processed, nafdac_reminder,
  -- flash_sale, surprise_drop, diary_post, editorial_pick, etc.
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,                             -- payload for deep linking
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Cook diary posts (shown in followers' feeds)
CREATE TABLE cook_diary_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  body text NOT NULL,
  photo_url text,
  video_url text,
  view_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Cook community posts (cooks-only, private)
CREATE TABLE cook_community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  category text NOT NULL CHECK (category IN (
    'sourcing_tip', 'bulk_buying_group', 'recipe_idea', 'general'
  )),
  body text NOT NULL,
  photo_urls text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE cook_community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES cook_community_posts(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Chop Talk (cook-specific community wall — customers post, cook responds)
CREATE TABLE chop_talk_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  customer_id uuid REFERENCES users(id) NOT NULL,
  body text NOT NULL,
  photo_urls text[],
  order_count_with_cook integer NOT NULL, -- captured at time of posting
  is_pinned boolean DEFAULT false,
  is_milestone boolean DEFAULT false,     -- cook-flagged customer milestone
  created_at timestamptz DEFAULT now()
);

CREATE TABLE chop_talk_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES chop_talk_posts(id) NOT NULL,
  author_id uuid REFERENCES users(id) NOT NULL,
  body text NOT NULL,
  is_cook_reply boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
