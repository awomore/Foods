-- ══════════════════════════════════════════════════════════════════════════════
-- 023_phase7.sql  — Trust, Payments, Delivery & Compliance
-- Phase 7: SLA system, reliability scores, bank/identity verification,
--          rider accountability, enhanced fraud signals, catering milestones
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Delivery SLA columns on orders ────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_promised_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_sla_minutes     INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS delivery_sla_breached    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispute_window_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rider_assigned_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rider_user_id            UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── 2. SLA events table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sla_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT        NOT NULL CHECK (entity_type IN ('order','chef_booking','catering')),
  entity_id    UUID        NOT NULL,
  event_type   TEXT        NOT NULL,  -- 'accepted_late','preparation_late','delivery_late','no_show','breach'
  promised_at  TIMESTAMPTZ,
  actual_at    TIMESTAMPTZ DEFAULT NOW(),
  minutes_late INTEGER     DEFAULT 0,
  penalty_applied BOOLEAN  DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_events_entity ON sla_events(entity_type, entity_id);

-- ── 3. Reliability scores ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reliability_scores (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                 TEXT        NOT NULL CHECK (role IN ('cook','customer','rider')),
  score                NUMERIC(5,2) DEFAULT 100,
  on_time_deliveries   INTEGER     DEFAULT 0,
  late_deliveries      INTEGER     DEFAULT 0,
  cancellations        INTEGER     DEFAULT 0,
  no_shows             INTEGER     DEFAULT 0,
  disputes_raised      INTEGER     DEFAULT 0,  -- as customer (abuse signal)
  disputes_received    INTEGER     DEFAULT 0,  -- as cook (quality signal)
  disputes_won         INTEGER     DEFAULT 0,
  disputes_lost        INTEGER     DEFAULT 0,
  total_orders         INTEGER     DEFAULT 0,
  last_computed_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_reliability_scores_user ON reliability_scores(user_id, role);
CREATE INDEX IF NOT EXISTS idx_reliability_scores_role_score ON reliability_scores(role, score DESC);

-- ── 4. SLA penalties ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sla_penalties (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role           TEXT        NOT NULL,
  entity_type    TEXT        NOT NULL,
  entity_id      UUID        NOT NULL,
  penalty_type   TEXT        NOT NULL, -- 'late_delivery','cancellation','no_show','late_acceptance'
  penalty_amount NUMERIC(12,2) DEFAULT 0,
  score_deduction NUMERIC(5,2) DEFAULT 0,
  applied_at     TIMESTAMPTZ DEFAULT NOW(),
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_sla_penalties_user ON sla_penalties(user_id);

-- ── 5. Bank account verifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_verifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id               UUID,
  account_number        TEXT        NOT NULL,
  bank_code             TEXT        NOT NULL,
  account_name          TEXT,
  bank_name             TEXT,
  verified              BOOLEAN     DEFAULT false,
  verification_provider TEXT        DEFAULT 'paystack',
  raw_response          JSONB       DEFAULT '{}',
  verified_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, account_number, bank_code)
);

CREATE INDEX IF NOT EXISTS idx_bank_verifications_user ON bank_verifications(user_id);

-- ── 6. Identity verifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity_verifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_type     TEXT        NOT NULL CHECK (verification_type IN ('nin','bvn','passport','drivers_license')),
  document_number       TEXT        NOT NULL,
  first_name            TEXT,
  last_name             TEXT,
  date_of_birth         DATE,
  verified              BOOLEAN     DEFAULT false,
  verification_provider TEXT        DEFAULT 'paystack',
  raw_response          JSONB       DEFAULT '{}',
  verified_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, verification_type)
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON identity_verifications(user_id);

-- ── 7. Fraud signals ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_signals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  signal_type  TEXT        NOT NULL CHECK (signal_type IN (
                             'rapid_refunds','fake_order','payout_abuse',
                             'duplicate_account','velocity_breach','chargeback_abuse',
                             'multi_device','suspicious_ip'
                           )),
  severity     TEXT        NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  details      JSONB       DEFAULT '{}',
  auto_detected BOOLEAN    DEFAULT true,
  resolved     BOOLEAN     DEFAULT false,
  resolved_by  UUID        REFERENCES users(id),
  resolved_at  TIMESTAMPTZ,
  resolution_note TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_signals_user    ON fraud_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_open    ON fraud_signals(resolved, severity) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_fraud_signals_type    ON fraud_signals(signal_type);

-- ── 8. Rider deliveries ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rider_deliveries (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rider_user_id        UUID        REFERENCES users(id),
  rider_name           TEXT,
  rider_phone          TEXT,
  assigned_at          TIMESTAMPTZ DEFAULT NOW(),
  picked_up_at         TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  delivery_proof_url   TEXT,
  delivery_latitude    NUMERIC(10,7),
  delivery_longitude   NUMERIC(10,7),
  sla_promised_minutes INTEGER     DEFAULT 45,
  sla_breached         BOOLEAN     DEFAULT false,
  minutes_late         INTEGER,
  customer_confirmed   BOOLEAN     DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_deliveries_order  ON rider_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_deliveries_rider  ON rider_deliveries(rider_user_id);

-- ── 9. Address verifications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS address_verifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_address       TEXT        NOT NULL,
  formatted_address TEXT,
  latitude          NUMERIC(10,7),
  longitude         NUMERIC(10,7),
  place_id          TEXT,
  verified          BOOLEAN     DEFAULT false,
  in_service_area   BOOLEAN,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. Private chef booking SLA + deposit columns ────────────────────────────
ALTER TABLE private_chef_bookings
  ADD COLUMN IF NOT EXISTS deposit_amount                   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS deposit_percentage               INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS deposit_paid                     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_paid_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_tx_ref                   TEXT,
  ADD COLUMN IF NOT EXISTS final_amount                     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS final_paid                       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_paid_at                    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_confirmed_by_customer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_window_closes_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_deadline                     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached                     BOOLEAN DEFAULT false;

-- ── 11. Catering milestone payments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catering_milestones (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id               UUID        NOT NULL,
  milestone_name           TEXT        NOT NULL,
  amount                   NUMERIC(12,2) NOT NULL,
  percentage_of_total      INTEGER,
  due_at                   TIMESTAMPTZ,
  paid                     BOOLEAN     DEFAULT false,
  paid_at                  TIMESTAMPTZ,
  payment_tx_ref           TEXT,
  accepted_by_cook         BOOLEAN,
  accepted_at              TIMESTAMPTZ,
  deliverable_description  TEXT,
  escrow_hold_id           UUID,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catering_milestones_request ON catering_milestones(request_id);

-- ── 12. Payout hold extensions ────────────────────────────────────────────────
ALTER TABLE escrow_holds
  ADD COLUMN IF NOT EXISTS hold_reason            TEXT,
  ADD COLUMN IF NOT EXISTS dispute_window_active  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_verified          BOOLEAN DEFAULT false;

-- ── 13. Cook profile verification columns ────────────────────────────────────
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS bank_verified           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_verified_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_verified       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reliability_score       NUMERIC(5,2) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS payout_blocked          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_blocked_reason   TEXT;

-- ── 14. User fraud/reliability columns ───────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS fraud_flagged         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_flagged_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_risk_level    TEXT DEFAULT 'low' CHECK (account_risk_level IN ('low','medium','high','critical')),
  ADD COLUMN IF NOT EXISTS device_fingerprints   TEXT[] DEFAULT '{}';

-- ── 15. Helper function: compute reliability score ────────────────────────────
CREATE OR REPLACE FUNCTION compute_reliability_score(
  p_on_time      INTEGER,
  p_late         INTEGER,
  p_cancels      INTEGER,
  p_no_shows     INTEGER,
  p_disputes_lost INTEGER,
  p_total        INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  base_score  NUMERIC := 100;
  on_time_rate NUMERIC;
BEGIN
  IF p_total = 0 THEN RETURN 100; END IF;

  on_time_rate := p_on_time::NUMERIC / p_total;

  -- Deduct for late deliveries (up to -30)
  base_score := base_score - LEAST(p_late * 3, 30);

  -- Deduct for cancellations (up to -25)
  base_score := base_score - LEAST(p_cancels * 5, 25);

  -- Deduct for no-shows (up to -20)
  base_score := base_score - LEAST(p_no_shows * 10, 20);

  -- Deduct for lost disputes (up to -15)
  base_score := base_score - LEAST(p_disputes_lost * 5, 15);

  -- On-time rate bonus (up to +10)
  base_score := base_score + (on_time_rate * 10);

  RETURN GREATEST(LEAST(ROUND(base_score, 2), 100), 0);
END;
$$ LANGUAGE plpgsql;
