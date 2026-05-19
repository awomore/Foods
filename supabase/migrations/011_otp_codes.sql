-- ============================================================
-- FOODSbyme Migration 011: otp_codes
-- Custom OTP authentication (replaces Supabase Auth).
-- OTPs are sent via Termii SMS and verified server-side.
-- ============================================================

CREATE TABLE otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  code text NOT NULL,
  attempts integer DEFAULT 0,             -- max 5 before lockout
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Auto-clean expired OTPs (optional — scheduler also handles this)
CREATE INDEX idx_otp_expiry ON otp_codes(expires_at);
