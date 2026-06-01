-- ============================================================
-- FOODSbyme Migration 018: Phase 5 — Trust, Safety & Credibility
-- ============================================================

-- ── menu_items: dietary labels & video media ──────────────────────────────────
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS dietary_labels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS videos         text[] NOT NULL DEFAULT '{}';

-- ── cook_profiles: verification badges & trust score ─────────────────────────
-- food_safety_verified + id_verified referenced by admin.js (add if absent)
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS food_safety_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verified          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS health_certified     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS licensed_kitchen     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS professional_chef    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_score          numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_code            text;

-- ── verification_submissions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verification_submissions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id        uuid        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  type           text        NOT NULL CHECK (type IN (
    'food_safety_certificate',
    'health_certificate',
    'cac_registration',
    'culinary_certification',
    'nafdac_approval',
    'government_permit'
  )),
  title          text,
  institution    text,
  document_url   text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes   text,
  submitted_at   timestamptz NOT NULL DEFAULT NOW(),
  reviewed_at    timestamptz,
  reviewed_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  expires_at     date,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_cook   ON verification_submissions(cook_id);
CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_submissions(status);
CREATE INDEX IF NOT EXISTS idx_verification_type   ON verification_submissions(cook_id, type);

-- ── review_reports: cook can flag abusive reviews ────────────────────────────
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS cook_reply_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reported        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_reason   text;

-- ── trust score computation ───────────────────────────────────────────────────
-- Called after orders, reviews, or cancellations change.
CREATE OR REPLACE FUNCTION compute_trust_score(p_cook_id uuid)
RETURNS numeric AS $$
DECLARE
  v_rating        numeric;
  v_completion    numeric;
  v_repeat        numeric;
  v_verified      boolean;
  v_certs         int;
  v_score         numeric;
BEGIN
  SELECT
    COALESCE(average_rating, 0),
    COALESCE(repeat_order_rate, 0),
    (food_safety_verified OR id_verified OR health_certified OR licensed_kitchen OR professional_chef)
  INTO v_rating, v_repeat, v_verified
  FROM cook_profiles
  WHERE id = p_cook_id;

  -- Completion: orders not cancelled / total
  SELECT COALESCE(
    100.0 * COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded'))
    / NULLIF(COUNT(*), 0),
    100
  ) INTO v_completion
  FROM orders WHERE cook_id = p_cook_id;

  SELECT COUNT(*) INTO v_certs
  FROM verification_submissions
  WHERE cook_id = p_cook_id AND status = 'approved';

  -- Weighted formula (max 100)
  v_score :=
    (v_rating / 5.0)    * 35   -- rating weight 35
    + (v_completion / 100) * 30  -- completion weight 30
    + (v_repeat / 100)   * 20   -- repeat rate weight 20
    + (CASE WHEN v_verified THEN 10 ELSE 0 END)  -- verification bonus 10
    + LEAST(v_certs * 1.5, 5);                   -- cert bonus max 5

  RETURN ROUND(LEAST(v_score, 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ── trigger to auto-update trust score on review changes ─────────────────────
CREATE OR REPLACE FUNCTION trg_update_trust_score()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'reviews' THEN
    UPDATE cook_profiles
      SET trust_score = compute_trust_score(NEW.cook_id)
    WHERE id = NEW.cook_id;
  ELSIF TG_TABLE_NAME = 'verification_submissions' AND NEW.status = 'approved' THEN
    UPDATE cook_profiles
      SET
        food_safety_verified = (food_safety_verified OR NEW.type = 'food_safety_certificate'),
        health_certified     = (health_certified     OR NEW.type = 'health_certificate'),
        licensed_kitchen     = (licensed_kitchen     OR NEW.type IN ('cac_registration','government_permit')),
        professional_chef    = (professional_chef    OR NEW.type = 'culinary_certification'),
        trust_score          = compute_trust_score(NEW.cook_id)
      WHERE id = NEW.cook_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_trust    ON reviews;
CREATE TRIGGER trg_review_trust
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_update_trust_score();

DROP TRIGGER IF EXISTS trg_cert_trust      ON verification_submissions;
CREATE TRIGGER trg_cert_trust
  AFTER UPDATE ON verification_submissions
  FOR EACH ROW WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION trg_update_trust_score();

-- ── indexes for dietary discovery ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_menu_dietary ON menu_items USING gin(dietary_labels);
