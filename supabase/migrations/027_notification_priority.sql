-- Migration 027: Notification priority tiers + delivery preferences
-- Adds a priority integer so high-signal notifications (order updates)
-- surface above low-signal ones (marketing), with per-user frequency caps
-- to prevent notification fatigue from suppressing critical messages.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority     integer DEFAULT 3;
  -- 1 = Transactional (order status, payment)  — deliver immediately
  -- 2 = Time-sensitive (live cook, flash sale)
  -- 3 = Discovery (new creator, new dish from followed cook)
  -- 4 = Marketing (promotions, digests)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at   timestamptz;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS batch_group  text;
  -- 'daily_digest' = hold for preferred_delivery_hour; null = deliver immediately

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id                      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_delivery_hour      integer DEFAULT 12,   -- 0–23 local hour
  dismissed_types              text[]  DEFAULT '{}',
  daily_non_transactional_count integer DEFAULT 0,
  count_reset_date             date DEFAULT CURRENT_DATE,
  updated_at                   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notif_priority_created
  ON notifications(user_id, priority ASC, created_at DESC);
