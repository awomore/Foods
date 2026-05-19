-- ============================================================
-- FOODSbyme Migration 001: users
-- The base table. Every cook, customer, and admin is a user first.
-- ============================================================

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text UNIQUE NOT NULL,
  email text UNIQUE,
  role text NOT NULL CHECK (role IN ('cook', 'customer', 'admin')),
  avatar_url text,
  push_token text,
  language_preference text DEFAULT 'en'
    CHECK (language_preference IN ('en', 'yo', 'ig', 'ha')),
  referral_code text UNIQUE,
  referred_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Index for referral lookups
CREATE INDEX idx_users_referral_code ON users(referral_code);
