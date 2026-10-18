-- Which payment rail took each charge.
--
-- With one rail (Flutterwave) every tx_ref was verified against it. A second
-- rail (Bachs) means a reference has to be verified, refunded and reconciled
-- with the rail that created it, and Bachs can only look a charge up by its own
-- checkout id, never by our reference. payments/orchestrator.js writes a row
-- here when it creates a charge and reads it back to route every later call.
-- References with no row predate this table and stay on Flutterwave.

CREATE TABLE IF NOT EXISTS gateway_charges (
  reference            TEXT        PRIMARY KEY,
  connector            TEXT        NOT NULL,
  provider_checkout_id TEXT,
  user_id              UUID        REFERENCES users(id),
  amount               NUMERIC(14,2),
  currency             CHAR(3),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_charges_checkout ON gateway_charges (provider_checkout_id);
