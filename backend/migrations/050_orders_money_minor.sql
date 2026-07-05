-- ============================================================
-- 050 — Phase 2c: minor-unit money columns on orders (expand)
-- ============================================================
-- First 2c table slice. Adds integer minor-unit (kobo) siblings for every money
-- column on `orders` and backfills from the existing NUMERIC(12,2) columns. This
-- is the EXPAND phase: the new columns are nullable (fees default 0) and the app
-- (routes/orders.js) dual-writes both representations. A later CONTRACT slice
-- sets NOT NULL and drops the NUMERIC columns once dual-write has run in prod.
--
-- All supported currencies have exponent 2, so minor = ROUND(major * 100).
-- Additive + backfill only — safe and reversible (see 050_..down.sql).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS unit_price_minor    BIGINT,
  ADD COLUMN IF NOT EXISTS subtotal_minor      BIGINT,
  ADD COLUMN IF NOT EXISTS delivery_fee_minor  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_minor  BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount_minor  BIGINT,
  ADD COLUMN IF NOT EXISTS cook_payout_minor   BIGINT,
  ADD COLUMN IF NOT EXISTS refund_amount_minor BIGINT;

UPDATE orders SET
  unit_price_minor    = ROUND(unit_price   * 100)::BIGINT,
  subtotal_minor      = ROUND(subtotal     * 100)::BIGINT,
  delivery_fee_minor  = ROUND(delivery_fee * 100)::BIGINT,
  platform_fee_minor  = ROUND(platform_fee * 100)::BIGINT,
  total_amount_minor  = ROUND(total_amount * 100)::BIGINT,
  cook_payout_minor   = ROUND(cook_payout  * 100)::BIGINT,
  refund_amount_minor = CASE WHEN refund_amount IS NOT NULL
                             THEN ROUND(refund_amount * 100)::BIGINT END;
