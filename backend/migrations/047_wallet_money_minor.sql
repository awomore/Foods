-- ============================================================
-- 047 — Phase 2a: minor-unit money columns on wallet tables
-- ============================================================
-- Introduces the integer minor-unit representation (kobo) alongside the legacy
-- NUMERIC `_ngn` columns. This is the DUAL-WRITE phase: both representations are
-- kept in sync by the application (routes/wallet.js, routes/gifting.js). A later
-- migration will drop the `_ngn` columns once every reader consumes `_minor`.
--
-- Additive + backfill only — safe and reversible (see 047_..down.sql).
-- NGN exponent is 2, so minor = ROUND(major * 100).

-- ── wallet_balances ────────────────────────────────────────────
ALTER TABLE wallet_balances
  ADD COLUMN IF NOT EXISTS balance_minor BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency      CHAR(3) NOT NULL DEFAULT 'NGN';

-- ── wallet_transactions ────────────────────────────────────────
-- amount_minor is added nullable so the backfill can populate it before the
-- NOT NULL constraint is applied below.
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS amount_minor BIGINT,
  ADD COLUMN IF NOT EXISTS currency     CHAR(3) NOT NULL DEFAULT 'NGN';

-- ── backfill from legacy naira columns ─────────────────────────
UPDATE wallet_balances
  SET balance_minor = ROUND(balance_ngn * 100)::BIGINT
  WHERE balance_ngn IS NOT NULL;

UPDATE wallet_transactions
  SET amount_minor = ROUND(amount_ngn * 100)::BIGINT
  WHERE amount_minor IS NULL AND amount_ngn IS NOT NULL;

-- Every transaction row now has a minor amount; enforce it going forward.
ALTER TABLE wallet_transactions
  ALTER COLUMN amount_minor SET NOT NULL;
