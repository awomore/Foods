-- ══════════════════════════════════════════════════════════════════════════════
-- 034_fez_delivery.sql — Fez Delivery Integration
-- Adds Fez-specific columns to orders so we can dispatch riders and track status
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_provider    TEXT,           -- 'fez' | null
  ADD COLUMN IF NOT EXISTS recipient_state      TEXT,           -- Nigerian state for Fez routing
  ADD COLUMN IF NOT EXISTS fez_order_number     TEXT,           -- Fez-assigned order number
  ADD COLUMN IF NOT EXISTS fez_batch_id         TEXT,           -- BatchID sent to Fez
  ADD COLUMN IF NOT EXISTS fez_dispatch_status  TEXT;           -- 'pending' | 'dispatched' | 'failed'

CREATE INDEX IF NOT EXISTS idx_orders_fez_order_number ON orders(fez_order_number) WHERE fez_order_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_provider ON orders(delivery_provider) WHERE delivery_provider IS NOT NULL;
