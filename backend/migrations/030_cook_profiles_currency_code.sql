-- ── cook_profiles.currency_code ──────────────────────────────────────────────
-- earnings.js selects currency_code from cook_profiles (payout currency)
-- but the column never existed in production, 500ing GET /earnings.

ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'NGN';
