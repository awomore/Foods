-- ============================================================
-- 052 — cook_profiles.otp_required (schema-drift fix)
-- ============================================================
-- routes/cooks.js PATCH /cooks/:id (and PATCH /cooks/me) writes an
-- `otp_required` flag on cook_profiles — the cook's per-order preference for
-- requiring an OTP handshake at delivery (later copied onto orders.otp_enabled,
-- see migration 040 which added otp_required to the delivery/fleet side only).
-- The cook_profiles column itself was never created, so every cook-profile
-- update — INCLUDING saving the payout bank account — 500'd with
-- `column "otp_required" does not exist`. This adds the missing column.
--
-- Additive + idempotent — safe and reversible (see 052_..down.sql).

ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS otp_required BOOLEAN NOT NULL DEFAULT false;
