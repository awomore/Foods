-- ============================================================
-- DOWN: Revert 051_payouts_money_minor.sql
-- ============================================================
-- Drops the minor-unit columns. The NUMERIC(12,2) money columns were never
-- removed in the expand phase, so payouts remain fully intact.

ALTER TABLE payouts
  DROP COLUMN IF EXISTS amount_minor,
  DROP COLUMN IF EXISTS instant_fee_minor;
