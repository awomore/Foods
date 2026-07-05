-- ============================================================
-- DOWN: Revert 049_ledger.sql
-- ============================================================
-- Drops the double-entry ledger. Additive migration, so this fully reverts it.

DROP TABLE IF EXISTS ledger_entries;
DROP TABLE IF EXISTS ledger_accounts;
