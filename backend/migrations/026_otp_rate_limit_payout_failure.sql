-- OTP send-rate tracking (3 per phone per hour)
ALTER TABLE otp_codes
  ADD COLUMN IF NOT EXISTS send_count        INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS send_window_start TIMESTAMPTZ;

-- Payout failure reason for operator visibility
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;
