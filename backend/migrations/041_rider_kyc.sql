-- ══════════════════════════════════════════════════════════════════════════════
-- 041_rider_kyc.sql — Rider Identity Verification (BVN / NIN via Flutterwave)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE rider_profiles
  ADD COLUMN IF NOT EXISTS kyc_type         TEXT        CHECK (kyc_type IN ('bvn', 'nin')),
  ADD COLUMN IF NOT EXISTS kyc_id_suffix    TEXT,        -- last 4 digits only (no raw BVN/NIN stored)
  ADD COLUMN IF NOT EXISTS kyc_status       TEXT        NOT NULL DEFAULT 'not_verified'
                                              CHECK (kyc_status IN ('not_verified', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS kyc_verified_name  TEXT,
  ADD COLUMN IF NOT EXISTS kyc_verified_dob   TEXT,
  ADD COLUMN IF NOT EXISTS kyc_verified_phone TEXT,
  ADD COLUMN IF NOT EXISTS kyc_verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_error          TEXT;

CREATE INDEX IF NOT EXISTS idx_rider_profiles_kyc ON rider_profiles(kyc_status);
