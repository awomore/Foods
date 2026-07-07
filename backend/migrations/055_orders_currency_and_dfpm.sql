-- ============================================================
-- 055 — orders.currency_code + orders.delivery_fee_payment_method (drift fix)
-- ============================================================
-- CRITICAL: routes/orders.js POST /orders INSERTs both columns on every order,
-- and the payment webhook / ledger capture / GET /orders read currency_code.
-- Neither column was ever added to `orders` (currency_code exists on
-- cook_profiles via 030, and delivery_fee_payment_method on the delivery/fleet
-- table via 040 — but not here). So EVERY order placement 500'd with
-- `column "currency_code" of relation "orders" does not exist`. Uncaught because
-- the e2e harness never creates orders; found while verifying the wallet-paid
-- order path this session.
--
-- Types/defaults mirror the sibling definitions: currency_code TEXT NOT NULL
-- DEFAULT 'NGN' (as on cook_profiles, migration 030); delivery_fee_payment_method
-- TEXT DEFAULT 'wallet' (as on the delivery table, migration 040). The INSERT
-- always supplies both; the defaults only cover any pre-existing rows (none —
-- pre-launch). Additive + idempotent — safe and reversible.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS currency_code               TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS delivery_fee_payment_method TEXT          DEFAULT 'wallet';
