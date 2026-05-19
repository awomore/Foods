-- ============================================================
-- FOODSbyme Migration 009: financial tools, referrals, verification, admin
-- ============================================================

-- Àdùn Advance (revenue-based advance for cooks)
CREATE TABLE cook_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  amount decimal NOT NULL,                -- up to 50% of trailing 30-day earnings
  fee_amount decimal NOT NULL,            -- 6.5% of amount
  total_repayment decimal NOT NULL,       -- amount + fee_amount
  repaid_amount decimal DEFAULT 0,
  repayment_rate decimal DEFAULT 0.20,    -- 20% of each payout
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'disbursed', 'repaying', 'repaid', 'rejected'
  )),
  disbursed_at timestamptz,
  repaid_at timestamptz,
  flutterwave_tx_ref text,
  created_at timestamptz DEFAULT now()
);

-- Cook savings pot
CREATE TABLE cook_savings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) UNIQUE NOT NULL,
  balance decimal DEFAULT 0,
  auto_save_rate decimal DEFAULT 0,       -- % of each payout
  goal_amount decimal,
  goal_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE cook_savings_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_id uuid REFERENCES cook_savings(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'auto_save')),
  amount decimal NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Payout records
CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  amount decimal NOT NULL,
  type text NOT NULL CHECK (type IN ('standard', 'instant')),
  instant_fee decimal DEFAULT 0,          -- 1% capped at ₦500
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  flutterwave_transfer_ref text,
  flutterwave_transfer_id text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Referrals
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES users(id) NOT NULL,
  referred_id uuid REFERENCES users(id) NOT NULL,
  referrer_role text NOT NULL CHECK (referrer_role IN ('cook', 'customer')),
  status text DEFAULT 'signed_up' CHECK (status IN (
    'signed_up', 'first_order', 'qualified'
  )),
  -- Cook referrals qualify at referred cook's 10th order
  -- Customer referrals qualify at referred customer's first order
  reward_paid boolean DEFAULT false,
  reward_amount decimal,
  created_at timestamptz DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);

-- Cook verification log (tracks incidents)
CREATE TABLE cook_verification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  action text NOT NULL CHECK (action IN (
    'approved', 'suspended', 'reinstated', 'went_dark',
    'nafdac_reminder_15', 'nafdac_reminder_25', 'nafdac_auto_suspended',
    'report_filed', 'report_resolved', 'annual_reverification'
  )),
  details text,
  performed_by uuid REFERENCES users(id), -- admin who performed action, null for system
  created_at timestamptz DEFAULT now()
);

-- Cook reports (customer or system reports against a cook)
CREATE TABLE cook_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  reported_by uuid REFERENCES users(id),  -- null if system-generated
  order_id uuid REFERENCES orders(id),
  type text NOT NULL CHECK (type IN (
    'food_quality', 'hygiene', 'late_delivery', 'no_show',
    'wrong_item', 'rude_behaviour', 'food_safety', 'other'
  )),
  severity text DEFAULT 'standard' CHECK (severity IN ('standard', 'severe')),
  description text,
  photos text[],
  status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Cook availability (blocked dates)
CREATE TABLE cook_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  blocked_date date NOT NULL,
  reason text,
  is_recurring boolean DEFAULT false,     -- e.g. "never cook on Sundays"
  recurring_day integer,                  -- 0=Sunday, 6=Saturday
  created_at timestamptz DEFAULT now(),
  UNIQUE (cook_id, blocked_date)
);

-- Cook academy progress
CREATE TABLE cook_academy_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  course_id text NOT NULL,                -- e.g. 'food_safety', 'phone_photography'
  module_id text NOT NULL,
  completed boolean DEFAULT false,
  quiz_score integer,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (cook_id, course_id, module_id)
);

-- Cook badges (earned from academy, performance, etc.)
CREATE TABLE cook_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  badge_type text NOT NULL CHECK (badge_type IN (
    'nafdac_ready', 'great_photos', 'content_creator',
    'health_kitchen', 'nutritionist_verified', 'top_rated',
    'community_favourite', 'fast_responder'
  )),
  earned_at timestamptz DEFAULT now(),
  UNIQUE (cook_id, badge_type)
);

-- Platform settings (admin-configurable)
CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Seed platform settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('commission_rate', '0.0375', 'Platform commission rate (3.75%)'),
  ('nafdac_deadline_days', '35', 'Days after approval before NAFDAC auto-suspend'),
  ('cook_went_dark_minutes', '90', 'Minutes before window close to check for unready orders'),
  ('realtime_confirm_minutes', '15', 'Minutes for cook to confirm realtime order'),
  ('instant_payout_fee_rate', '0.01', 'Instant payout fee rate (1%)'),
  ('instant_payout_fee_cap', '500', 'Instant payout fee cap in Naira'),
  ('advance_fee_rate', '0.065', 'Àdùn Advance fee (6.5%)'),
  ('advance_max_percentage', '0.50', 'Max advance as % of trailing 30-day earnings'),
  ('advance_repayment_rate', '0.20', 'Advance repayment rate per payout (20%)'),
  ('open_reports_before_auto_pause', '3', 'Open reports threshold to auto-pause cook'),
  ('gold_monthly_price', '3500', 'FOODSbyme Gold monthly subscription price'),
  ('loyalty_points_per_1000', '10', 'Table Points earned per ₦1,000 spent'),
  ('flash_sale_slots_threshold', '3', 'Slots remaining to trigger flash sale'),
  ('flash_sale_minutes_before_close', '90', 'Minutes before close to trigger flash'),
  ('flash_sale_discount_pct', '0.20', 'Flash sale discount (20%)'),
  ('maintenance_mode', 'false', 'Platform maintenance mode');
