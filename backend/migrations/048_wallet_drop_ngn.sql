-- ============================================================
-- 048 — Phase 2b: retire legacy naira columns on wallet tables
-- ============================================================
-- The minor-unit columns added in 047 are now the sole source of truth:
-- routes/wallet.js and routes/gifting.js read and write only `*_minor`, and
-- the `balance_ngn` API field is derived from `balance_minor`. Drop the now
-- unused legacy NUMERIC naira columns.
--
-- Reversible — see 048_wallet_drop_ngn.down.sql (re-adds + backfills from
-- `*_minor`). Deploy only after 047's dual-write has run in production and
-- `_minor` ↔ `_ngn` parity is confirmed.

ALTER TABLE wallet_balances     DROP COLUMN IF EXISTS balance_ngn;
ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS amount_ngn;
