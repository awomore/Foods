-- ============================================================
-- FOODSbyme Migration 002: cook_profiles
-- Every cook gets a profile after signing up with role='cook'.
-- This is the most referenced table in the system.
-- ============================================================

CREATE TABLE cook_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) UNIQUE NOT NULL,
  display_name text NOT NULL,
  username text UNIQUE NOT NULL,
  -- Social links: stored without @ prefix
  -- Resolve at: foodsbyme.com/ig/[instagram_handle], foodsbyme.com/tt/[tiktok_handle]
  instagram_handle text,
  tiktok_handle text,
  youtube_url text,
  bio text,
  location text,                          -- e.g. "Lekki Phase 1, Lagos"
  lga text,                               -- Lagos local government area
  latitude decimal,
  longitude decimal,
  kitchen_photos text[],                  -- min 3 Cloudinary URLs
  
  -- Verification
  verification_status text DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'approved', 'suspended', 'on_break')),
  nin_number text,                        -- AES-256 encrypted at app level
  nin_verified boolean DEFAULT false,
  address_proof_type text CHECK (address_proof_type IN ('utility_bill', 'bank_statement')),
  address_proof_url text,
  address_proof_verified boolean DEFAULT false,
  
  -- NAFDAC
  nafdac_certificate_url text,
  nafdac_verified boolean DEFAULT false,
  nafdac_status text DEFAULT 'not_submitted'
    CHECK (nafdac_status IN ('not_submitted', 'in_progress', 'submitted', 'verified', 'expired')),
  nafdac_approval_date timestamptz,       -- for 35-day countdown
  
  -- Other credentials
  other_certificates jsonb,               -- [{title, institution, issue_date, expiry_date, certificate_url}]
  profile_video_url text,                 -- cook intro video, max 60s
  
  -- Stats (computed)
  repeat_order_rate decimal DEFAULT 0,    -- computed nightly by cron
  total_orders integer DEFAULT 0,
  average_rating decimal DEFAULT 0,
  platform_follower_count integer DEFAULT 0,  -- maintained by trigger
  chop_talk_post_count integer DEFAULT 0,     -- maintained by trigger
  
  -- Status
  is_live boolean DEFAULT false,
  is_health_kitchen boolean DEFAULT false,
  approved_as_health_kitchen boolean DEFAULT false,
  is_accepting_tips boolean DEFAULT true,
  
  -- Storefront
  storefront_title text,
  storefront_bio text,
  banner_image_url text,
  
  -- Operating hours
  pronouns text DEFAULT 'she_her'
    CHECK (pronouns IN ('she_her', 'he_him', 'they_them')),
  open_time_default time,                 -- e.g. 07:00
  close_time_default time,                -- e.g. 21:00
  open_hours_by_day jsonb,
  -- {"monday":{"open":"07:00","close":"21:00"},"sunday":{"open":null,"close":null}}
  
  -- Bank details for payouts
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  flutterwave_subaccount_id text,
  
  created_at timestamptz DEFAULT now()
);

-- Indexes for discovery and search
CREATE UNIQUE INDEX idx_cook_username ON cook_profiles(username);
CREATE INDEX idx_cook_instagram ON cook_profiles(instagram_handle);
CREATE INDEX idx_cook_tiktok ON cook_profiles(tiktok_handle);
CREATE INDEX idx_cook_location ON cook_profiles(latitude, longitude);
CREATE INDEX idx_cook_verification ON cook_profiles(verification_status);
CREATE INDEX idx_cook_live ON cook_profiles(is_live) WHERE is_live = true;
