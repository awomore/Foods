-- ============================================================
-- 056 — payouts.currency_code (schema-drift fix)
-- ============================================================
-- routes/earnings.js POST /payout INSERTs `currency_code` into payouts, and the
-- mobile payout history renders each payout's amount in its currency. The column
-- was never created, so the payout INSERT itself would 500 with
-- `column "currency_code" of relation "payouts" does not exist` — i.e. no cook
-- could ever request a payout. Uncaught pre-launch (payouts need delivered orders
-- + a verified bank). Same drift class as 055 (orders) and 052-054.
--
-- Matches the sibling definition on cook_profiles (migration 030): TEXT NOT NULL
-- DEFAULT 'NGN'. The INSERT always supplies it; the default only covers any
-- pre-existing rows (none). Additive + idempotent — safe and reversible.

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'NGN';
