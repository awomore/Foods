-- Migration 045: Relay by Chowdeck delivery columns

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS relay_reference  VARCHAR,
  ADD COLUMN IF NOT EXISTS relay_status     VARCHAR;

CREATE INDEX IF NOT EXISTS idx_orders_relay_reference ON orders (relay_reference) WHERE relay_reference IS NOT NULL;
