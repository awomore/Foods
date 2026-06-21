-- Track whether a delay push notification has been sent for an order
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delay_notified_at TIMESTAMPTZ;
