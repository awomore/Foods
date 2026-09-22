-- Rolling back reopens every payment to reuse; see 069_payment_claims.sql.

-- The four-naira-amount constraint is not restored: cards of other values may
-- exist by now, and it would refuse them.
DROP INDEX IF EXISTS gift_cards_tx_ref_key;
ALTER TABLE gift_cards DROP COLUMN IF EXISTS tx_ref;
DROP TABLE IF EXISTS payment_claims;
