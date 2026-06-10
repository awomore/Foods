-- ============================================================
-- DOWN: Revert 023_phase7.sql
-- ============================================================

DROP FUNCTION IF EXISTS compute_reliability_score(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);

DROP TABLE IF EXISTS catering_milestones;
DROP TABLE IF EXISTS rider_deliveries;
DROP TABLE IF EXISTS address_verifications;
DROP TABLE IF EXISTS identity_verifications;
DROP TABLE IF EXISTS bank_verifications;
DROP TABLE IF EXISTS fraud_signals;
DROP TABLE IF EXISTS sla_penalties;
DROP TABLE IF EXISTS reliability_scores;
DROP TABLE IF EXISTS sla_events;

ALTER TABLE orders
  DROP COLUMN IF EXISTS delivery_promised_at,
  DROP COLUMN IF EXISTS delivery_sla_minutes,
  DROP COLUMN IF EXISTS delivery_sla_breached,
  DROP COLUMN IF EXISTS dispute_window_closes_at,
  DROP COLUMN IF EXISTS accepted_at,
  DROP COLUMN IF EXISTS rider_assigned_at,
  DROP COLUMN IF EXISTS rider_user_id;

ALTER TABLE private_chef_bookings
  DROP COLUMN IF EXISTS deposit_amount,
  DROP COLUMN IF EXISTS deposit_percentage,
  DROP COLUMN IF EXISTS deposit_paid,
  DROP COLUMN IF EXISTS deposit_paid_at,
  DROP COLUMN IF EXISTS deposit_tx_ref,
  DROP COLUMN IF EXISTS final_amount,
  DROP COLUMN IF EXISTS final_paid,
  DROP COLUMN IF EXISTS final_paid_at,
  DROP COLUMN IF EXISTS completion_confirmed_by_customer,
  DROP COLUMN IF EXISTS review_window_closes_at,
  DROP COLUMN IF EXISTS sla_deadline,
  DROP COLUMN IF EXISTS sla_breached;

ALTER TABLE escrow_holds
  DROP COLUMN IF EXISTS hold_reason,
  DROP COLUMN IF EXISTS dispute_window_active,
  DROP COLUMN IF EXISTS bank_verified;

ALTER TABLE cook_profiles
  DROP COLUMN IF EXISTS bank_verified,
  DROP COLUMN IF EXISTS bank_verified_at,
  DROP COLUMN IF EXISTS identity_verified,
  DROP COLUMN IF EXISTS identity_verified_at,
  DROP COLUMN IF EXISTS reliability_score,
  DROP COLUMN IF EXISTS payout_blocked,
  DROP COLUMN IF EXISTS payout_blocked_reason;

ALTER TABLE users
  DROP COLUMN IF EXISTS fraud_flagged,
  DROP COLUMN IF EXISTS fraud_flagged_at,
  DROP COLUMN IF EXISTS account_risk_level,
  DROP COLUMN IF EXISTS device_fingerprints;
