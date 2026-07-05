-- ============================================================
-- DOWN: Revert 048_wallet_drop_ngn.sql
-- ============================================================
-- Re-add the legacy naira columns and repopulate them from the minor-unit
-- source of truth (NGN exponent = 2, so naira = minor / 100).

ALTER TABLE wallet_balances
  ADD COLUMN IF NOT EXISTS balance_ngn NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS amount_ngn NUMERIC(15,2);

UPDATE wallet_balances     SET balance_ngn = balance_minor / 100.0;
UPDATE wallet_transactions SET amount_ngn  = amount_minor  / 100.0
  WHERE amount_minor IS NOT NULL;

ALTER TABLE wallet_transactions
  ALTER COLUMN amount_ngn SET NOT NULL;
