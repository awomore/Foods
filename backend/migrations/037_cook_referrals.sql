-- P5-24: Cook referral program
CREATE TABLE IF NOT EXISTS cook_referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  referral_code   TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'qualified', 'rewarded')),
  reward_amount   NUMERIC(10,2),
  reward_currency TEXT DEFAULT 'NGN',
  signed_up_at    TIMESTAMPTZ,
  qualified_at    TIMESTAMPTZ,
  rewarded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cook_referrals_referrer ON cook_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_cook_referrals_code     ON cook_referrals(referral_code);

-- Add referral_code column to users for quick lookup on signup
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
