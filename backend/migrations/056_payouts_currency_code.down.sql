-- Reverse 056 — drop the currency_code column from payouts.
ALTER TABLE payouts DROP COLUMN IF EXISTS currency_code;
