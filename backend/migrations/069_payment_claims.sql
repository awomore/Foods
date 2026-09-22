-- One payment, one purchase.
--
-- Every route that takes a gateway tx_ref checked that the charge succeeded,
-- and none of them checked that it had not already been spent. A single real
-- charge could enrol a course, buy a product, top up the wallet and (via the
-- webhook) confirm any order that cited its reference -- and gift cards and
-- subscriptions did not check the charge at all. Wallet debits were the same:
-- one WALLET-... ref could back any number of wallet-paid orders, of any size.
--
-- payment_claims records how much of each payment has been used. A claim is
-- keyed by the payment reference and bound to one purpose, one user and one
-- currency; payments/claims.js consumes it with a guarded UPDATE
-- (consumed_minor + use <= amount_minor) so it can never be overspent, even
-- across concurrent requests.
--
-- References already used before this migration are claimed as fully spent
-- (amount 0, consumed 0), so none of them can be replayed afterwards. Where the
-- same reference was used more than once, the first row wins; the audit script
-- (scripts/audit-payment-reuse.js) lists those.

CREATE TABLE IF NOT EXISTS payment_claims (
  reference      TEXT        PRIMARY KEY,
  purpose        TEXT        NOT NULL,
  user_id        UUID        NOT NULL REFERENCES users(id),
  currency       CHAR(3)     NOT NULL,
  amount_minor   BIGINT      NOT NULL CHECK (amount_minor >= 0),
  consumed_minor BIGINT      NOT NULL DEFAULT 0 CHECK (consumed_minor >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_claims_not_overspent CHECK (consumed_minor <= amount_minor)
);

CREATE INDEX IF NOT EXISTS idx_payment_claims_user ON payment_claims (user_id);

-- A gift card is now bought with a charge; each charge mints at most one card.
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS tx_ref TEXT;

-- The card's value was pinned to four naira amounts (2500/5000/10000/20000),
-- while the app offers 1000, 50000 and any custom value in the buyer's own
-- currency -- which failed only once the INSERT ran, and now would fail after
-- the buyer has paid. Any positive value is valid; the route checks it before
-- touching the payment.
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_denomination_check;
ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_denomination_check CHECK (denomination > 0);
CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_tx_ref_key ON gift_cards (tx_ref) WHERE tx_ref IS NOT NULL;

-- Backfill: every reference already spent is claimed and exhausted.
INSERT INTO payment_claims (reference, purpose, user_id, currency, amount_minor, consumed_minor)
SELECT DISTINCT ON (ref) ref, 'legacy_wallet_' || type, customer_id, currency, 0, 0
FROM wallet_transactions
WHERE ref IS NOT NULL AND type IN ('topup', 'debit')
ORDER BY ref, created_at
ON CONFLICT (reference) DO NOTHING;

INSERT INTO payment_claims (reference, purpose, user_id, currency, amount_minor, consumed_minor)
SELECT DISTINCT ON (flutterwave_tx_ref) flutterwave_tx_ref, 'legacy_order', customer_id, currency_code, 0, 0
FROM orders
WHERE flutterwave_tx_ref IS NOT NULL
  AND status NOT IN ('pending_payment', 'payment_failed')
ORDER BY flutterwave_tx_ref, created_at
ON CONFLICT (reference) DO NOTHING;

INSERT INTO payment_claims (reference, purpose, user_id, currency, amount_minor, consumed_minor)
SELECT DISTINCT ON (tx_ref) tx_ref, 'legacy_course', user_id, 'NGN', 0, 0
FROM course_enrollments
WHERE tx_ref IS NOT NULL
ORDER BY tx_ref
ON CONFLICT (reference) DO NOTHING;

INSERT INTO payment_claims (reference, purpose, user_id, currency, amount_minor, consumed_minor)
SELECT DISTINCT ON (tx_ref) tx_ref, 'legacy_product', user_id, 'NGN', 0, 0
FROM digital_product_purchases
WHERE tx_ref IS NOT NULL
ORDER BY tx_ref
ON CONFLICT (reference) DO NOTHING;

INSERT INTO payment_claims (reference, purpose, user_id, currency, amount_minor, consumed_minor)
SELECT DISTINCT ON (tx_ref) tx_ref, 'legacy_subscription', subscriber_id, 'NGN', 0, 0
FROM creator_subscriptions
WHERE tx_ref IS NOT NULL
ORDER BY tx_ref
ON CONFLICT (reference) DO NOTHING;
