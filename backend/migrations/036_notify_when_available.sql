-- P4-23: "Notify me when available" for sold-out dishes
CREATE TABLE IF NOT EXISTS notify_when_available (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, menu_item_id)
);
CREATE INDEX IF NOT EXISTS idx_notify_available_item ON notify_when_available(menu_item_id) WHERE notified_at IS NULL;
