-- 058: columns the code requires that production never received
--
-- Same cause as 057: these columns were added by hand to the development
-- database (Neon) and never written as migrations, so the Railway production
-- database does not have them. Generated mechanically from a live column diff
-- of the two databases, so the types match what the code has been running
-- against — 156 columns across 26 tables.
--
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS only. Nothing is dropped,
-- renamed or retyped.
--
-- There is deliberately no .down.sql. Reverting a deploy does not require
-- dropping these columns — unused additive columns are inert — whereas a down
-- migration that drops 156 columns is a data-loss weapon sitting in the repo.
--
-- NOT NULL was preserved only where the source column has a DEFAULT. Adding a
-- NOT NULL column with no default fails as soon as a table has rows, so the
-- following 15 arrive nullable and should be tightened once
-- backfilled:
--   catering_events.venue_address (text)
--   cook_discounts.type (text)
--   customer_health_profiles.customer_id (uuid)
--   digital_products.type (text)
--   disputes.type (text)
--   meal_subscriptions.gifter_id (uuid)
--   meal_subscriptions.plan_id (text)
--   meal_subscriptions.sub_type (text)
--   meal_subscriptions.recipient_name (text)
--   meal_subscriptions.recipient_phone (text)
--   meal_subscriptions.recipient_address (text)
--   private_chef_bookings.venue_address (text)
--   verification_submissions.type (text)
--   verification_submissions.document_url (text)
--   weekly_menus.week_start (date)
--
-- NOT covered here, deliberately:
--   * 5 type mismatches on columns that exist in both, where production and
--     development disagree (catering_events.event_time, cook_profiles.open_time_default,
--     cook_profiles.close_time_default, private_chef_bookings.event_time are text in
--     production vs time in development; orders.payout_batch_id is uuid vs text).
--     Retyping needs a decision about which side is right — see project memory.
--   * the 15 tables that exist in NEITHER database (analytics/metrics set,
--     interest graph, trending_entities, user_connections, story_completions,
--     subscription_meals, rider_locations). Those have no schema anywhere and
--     must be designed from their queries.
-- catering_events (18)
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS event_name text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS venue_address text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS venue_latitude numeric(10,7);
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS venue_longitude numeric(10,7);
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS menu_description text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS dietary_requirements text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS equipment_needed boolean DEFAULT false NOT NULL;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS service_staff_needed boolean DEFAULT false NOT NULL;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS quote_amount numeric(12,2);
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS deposit_transaction_id text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS final_amount numeric(12,2);
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS final_paid_at timestamptz;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS final_tx_ref text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS timeline jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS quote_message text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS quoted_at timestamptz;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS invoice_url text;
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS notes text;

-- chef_availability (2)
ALTER TABLE chef_availability ADD COLUMN IF NOT EXISTS time_slots jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE chef_availability ADD COLUMN IF NOT EXISTS notes text;

-- cook_discounts (6)
ALTER TABLE cook_discounts ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE cook_discounts ADD COLUMN IF NOT EXISTS discount_value numeric;
ALTER TABLE cook_discounts ADD COLUMN IF NOT EXISTS min_orders_required integer DEFAULT 0;
ALTER TABLE cook_discounts ADD COLUMN IF NOT EXISTS free_item_description text;
ALTER TABLE cook_discounts ADD COLUMN IF NOT EXISTS applies_to text DEFAULT 'all'::text;
ALTER TABLE cook_discounts ADD COLUMN IF NOT EXISTS claimed_count integer DEFAULT 0;

-- cook_profiles (25)
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS nin_number text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS nin_verified boolean DEFAULT false;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS address_proof_type text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS address_proof_url text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS address_proof_verified boolean DEFAULT false;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS nafdac_certificate_url text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS nafdac_verified boolean DEFAULT false;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS nafdac_status text DEFAULT 'not_submitted'::text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS nafdac_approval_date timestamptz;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS other_certificates jsonb;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS chop_talk_post_count integer DEFAULT 0;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS approved_as_health_kitchen boolean DEFAULT false;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS flutterwave_subaccount_id text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS social_verified boolean DEFAULT false;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS social_verification_code text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS social_verified_platform text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS social_verified_handle text;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS service_regions text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS travel_radius_km integer DEFAULT 20 NOT NULL;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS booking_lead_days integer DEFAULT 3 NOT NULL;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS min_guest_count integer DEFAULT 2 NOT NULL;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS max_guest_count integer DEFAULT 100 NOT NULL;
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS lat numeric(10,7);
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS lng numeric(10,7);
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS service_address text;

-- cook_savings (3)
ALTER TABLE cook_savings ADD COLUMN IF NOT EXISTS auto_save_rate numeric DEFAULT 0;
ALTER TABLE cook_savings ADD COLUMN IF NOT EXISTS goal_amount numeric;
ALTER TABLE cook_savings ADD COLUMN IF NOT EXISTS goal_name text;

-- course_enrollments (3)
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS tx_ref text;
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0 NOT NULL;
ALTER TABLE course_enrollments ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false NOT NULL;

-- courses (10)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN'::text NOT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS difficulty_level text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration_hours numeric(5,1);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false NOT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS enrollment_count integer DEFAULT 0 NOT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS rating numeric(3,2) DEFAULT 0 NOT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS lessons jsonb DEFAULT '[]'::jsonb NOT NULL;

-- custom_requests (8)
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS photos text[];
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS serving_count integer;
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS preferred_date date;
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS budget_range text;
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS quote_amount numeric;
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS quote_message text;
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS quoted_at timestamptz;
ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS order_id uuid;

-- customer_health_profiles (4)
ALTER TABLE customer_health_profiles ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE customer_health_profiles ADD COLUMN IF NOT EXISTS health_goals text[] DEFAULT '{}'::text[];
ALTER TABLE customer_health_profiles ADD COLUMN IF NOT EXISTS health_notes text;
ALTER TABLE customer_health_profiles ADD COLUMN IF NOT EXISTS is_visible_to_cooks boolean DEFAULT false;

-- customer_profiles (11)
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS dislikes text[] DEFAULT '{}'::text[];
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS dietary_type text DEFAULT 'none'::text;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS default_address text;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS default_address_label text DEFAULT 'Home'::text;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS default_latitude numeric;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS default_longitude numeric;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS saved_addresses jsonb DEFAULT '[]'::jsonb;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS flash_opt_in boolean DEFAULT true;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS is_gold boolean DEFAULT false;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS gold_started_at timestamptz;
ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS gold_expires_at timestamptz;

-- digital_products (6)
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS cover_image text;
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN'::text NOT NULL;
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS page_count integer;
ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[] NOT NULL;

-- disputes (1)
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS type text;

-- escrow_holds (2)
ALTER TABLE escrow_holds ADD COLUMN IF NOT EXISTS held_at timestamptz DEFAULT now() NOT NULL;
ALTER TABLE escrow_holds ADD COLUMN IF NOT EXISTS flw_tx_ref text;

-- loyalty_transactions (1)
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS cook_id uuid;

-- meal_subscriptions (11)
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS gifter_id uuid;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS plan_id text;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS sub_type text;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS meal_slots text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS add_dietician boolean DEFAULT false NOT NULL;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS recipient_phone text;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS recipient_address text;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS preferences text;
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS total_amount numeric(12,2);
ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS next_delivery timestamptz;

-- orders (3)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_arrival timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_out_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_released boolean DEFAULT false NOT NULL;

-- otp_codes (1)
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;

-- payouts (2)
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS flutterwave_transfer_ref text;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS flutterwave_transfer_id text;

-- platform_settings (2)
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- private_chef_bookings (22)
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS venue_address text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS venue_latitude numeric;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS venue_longitude numeric;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS dietary_requirements text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS quote_amount numeric;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS quote_breakdown jsonb;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS quote_message text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS quoted_at timestamptz;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS balance_amount numeric;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS balance_paid boolean DEFAULT false;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS flutterwave_deposit_ref text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS flutterwave_balance_ref text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS counter_offer_amount numeric(12,2);
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS counter_offer_notes text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS counter_offered_at timestamptz;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS contract_url text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS milestone_payments jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS balance_tx_ref text;
ALTER TABLE private_chef_bookings ADD COLUMN IF NOT EXISTS balance_transaction_id text;

-- reviews (1)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS cook_reply_at timestamptz;

-- tips (2)
ALTER TABLE tips ADD COLUMN IF NOT EXISTS cook_thank_you_note text;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS flutterwave_tx_ref text;

-- users (2)
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference text DEFAULT 'en'::text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by uuid;

-- verification_submissions (6)
ALTER TABLE verification_submissions ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE verification_submissions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE verification_submissions ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE verification_submissions ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE verification_submissions ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now() NOT NULL;
ALTER TABLE verification_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

-- wallet_transactions (1)
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS order_id uuid;

-- weekly_menus (3)
ALTER TABLE weekly_menus ADD COLUMN IF NOT EXISTS week_start date;
ALTER TABLE weekly_menus ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE weekly_menus ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb NOT NULL;
