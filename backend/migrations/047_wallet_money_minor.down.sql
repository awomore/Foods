-- ============================================================
-- DOWN: Revert 047_wallet_money_minor.sql
-- ============================================================
-- Drops the minor-unit columns. The legacy `_ngn` columns were never removed,
-- so wallet balances/transactions remain fully intact after this revert.

ALTER TABLE wallet_transactions
  DROP COLUMN IF EXISTS amount_minor,
  DROP COLUMN IF EXISTS currency;

ALTER TABLE wallet_balances
  DROP COLUMN IF EXISTS balance_minor,
  DROP COLUMN IF EXISTS currency;
