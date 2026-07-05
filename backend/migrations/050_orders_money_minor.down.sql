-- ============================================================
-- DOWN: Revert 050_orders_money_minor.sql
-- ============================================================
-- Drops the minor-unit columns. The NUMERIC(12,2) money columns were never
-- removed in the expand phase, so orders remain fully intact.

ALTER TABLE orders
  DROP COLUMN IF EXISTS unit_price_minor,
  DROP COLUMN IF EXISTS subtotal_minor,
  DROP COLUMN IF EXISTS delivery_fee_minor,
  DROP COLUMN IF EXISTS platform_fee_minor,
  DROP COLUMN IF EXISTS total_amount_minor,
  DROP COLUMN IF EXISTS cook_payout_minor,
  DROP COLUMN IF EXISTS refund_amount_minor;
