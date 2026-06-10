-- Migration 025: T&C consent capture
-- Adds explicit consent tracking to users and an idempotency table for webhooks.

-- ── Users: consent fields ────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tos_accepted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tos_version       TEXT DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;

-- ── Webhook idempotency guard ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processed_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL,          -- 'flutterwave'
  event_type      TEXT NOT NULL,          -- 'charge.completed'
  reference       TEXT NOT NULL,          -- tx_ref or event id
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_type, reference)
);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_ref ON processed_webhooks (provider, reference);

-- ── Order timeout: pending_acceptance state ───────────────────────────────────
-- Orders placed but not accepted by cook within 15 minutes auto-cancel.
-- The cron checks pending_payment / payment_confirmed orders older than 15 min
-- where cook has not set accepted_at.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS acceptance_deadline TIMESTAMPTZ;

-- DOWN:
-- ALTER TABLE users DROP COLUMN IF EXISTS tos_accepted_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS tos_version;
-- ALTER TABLE users DROP COLUMN IF EXISTS privacy_accepted_at;
-- DROP TABLE IF EXISTS processed_webhooks;
-- ALTER TABLE orders DROP COLUMN IF EXISTS acceptance_deadline;
