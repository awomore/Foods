-- ============================================================
-- 051 — Phase 2c: minor-unit money columns on payouts (expand)
-- ============================================================
-- Next 2c table slice (after 050 orders). Adds integer minor-unit (kobo)
-- siblings for the money columns on `payouts` and backfills from the existing
-- NUMERIC(12,2) columns. EXPAND phase: `amount_minor` is nullable (backfilled);
-- `instant_fee_minor` mirrors the source's NOT NULL DEFAULT 0. The app
-- (routes/earnings.js) dual-writes both representations on payout creation. A
-- later CONTRACT slice sets NOT NULL and drops the NUMERIC columns once
-- dual-write has run in prod. Lets the payout ledger draw-down (Phase 3 slice
-- 3c) reconcile against an exact minor-unit source.
--
-- All supported currencies have exponent 2, so minor = ROUND(major * 100).
-- Additive + backfill only — safe and reversible (see 051_..down.sql).

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS amount_minor      BIGINT,
  ADD COLUMN IF NOT EXISTS instant_fee_minor BIGINT NOT NULL DEFAULT 0;

UPDATE payouts SET
  amount_minor      = ROUND(amount      * 100)::BIGINT,
  instant_fee_minor = ROUND(instant_fee * 100)::BIGINT;
