-- ============================================================
-- FOODSbyme Migration 019: Marketplace Completion
-- Disputes · Escrow · Chef Availability · Catering
-- Courses · Digital Products · Invoices · Quotations
-- Weekly Menus · Creator Subscriptions · Affiliate Links
-- ============================================================

-- ── Extend cook_profiles ───────────────────────────────────────────────────────
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS service_regions      text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_radius_km     int     NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS booking_lead_days    int     NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS min_guest_count      int     NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_guest_count      int     NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS accepts_catering     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_private_chef boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lat                  numeric(10,7),
  ADD COLUMN IF NOT EXISTS lng                  numeric(10,7),
  ADD COLUMN IF NOT EXISTS service_address      text;

-- ── Extend orders: escrow + dispute link ───────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS escrow_released   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_dispute       boolean NOT NULL DEFAULT false;

-- ── Extend private_chef_bookings ──────────────────────────────────────────────
ALTER TABLE private_chef_bookings
  ADD COLUMN IF NOT EXISTS counter_offer_amount   numeric(12,2),
  ADD COLUMN IF NOT EXISTS counter_offer_notes    text,
  ADD COLUMN IF NOT EXISTS counter_offered_at     timestamptz,
  ADD COLUMN IF NOT EXISTS contract_url           text,
  ADD COLUMN IF NOT EXISTS contract_signed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS milestone_payments     jsonb  NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS balance_paid_at        timestamptz,
  ADD COLUMN IF NOT EXISTS balance_tx_ref         text,
  ADD COLUMN IF NOT EXISTS balance_transaction_id text;

-- Broaden status check on private_chef_bookings
ALTER TABLE private_chef_bookings
  DROP CONSTRAINT IF EXISTS private_chef_bookings_status_check;
ALTER TABLE private_chef_bookings
  ADD  CONSTRAINT private_chef_bookings_status_check
  CHECK (status IN (
    'enquiry','quoted','counter_offered','accepted',
    'contract_sent','deposit_paid','in_progress',
    'completed','cancelled','disputed'
  ));

-- ── chef_availability ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chef_availability (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id      uuid    NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  date         date    NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  time_slots   jsonb   NOT NULL DEFAULT '[]',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (cook_id, date)
);
CREATE INDEX IF NOT EXISTS idx_chef_avail_cook   ON chef_availability(cook_id);
CREATE INDEX IF NOT EXISTS idx_chef_avail_date   ON chef_availability(date);

-- ── disputes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid  NOT NULL REFERENCES orders(id),
  customer_id     uuid  NOT NULL REFERENCES users(id),
  cook_id         uuid  NOT NULL REFERENCES cook_profiles(id),
  type            text  NOT NULL CHECK (type IN (
    'wrong_order','not_delivered','quality_issue',
    'late_delivery','fraud','other'
  )),
  status          text  NOT NULL DEFAULT 'open' CHECK (status IN (
    'open','evidence_review','admin_review','resolved','escalated','closed'
  )),
  reason          text  NOT NULL,
  resolution      text,
  resolution_type text  CHECK (resolution_type IN (
    'full_refund','partial_refund','no_refund','replacement'
  )),
  refund_amount   numeric(12,2),
  admin_id        uuid  REFERENCES users(id),
  sla_deadline    timestamptz NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  escalated_at    timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_disputes_order    ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_cook     ON disputes(cook_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status   ON disputes(status);

-- ── dispute_evidence ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  uuid  NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES users(id),
  role        text  NOT NULL CHECK (role IN ('customer','cook','admin')),
  file_url    text  NOT NULL,
  file_type   text  NOT NULL CHECK (file_type IN ('image','video','document')),
  description text,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evidence_dispute ON dispute_evidence(dispute_id);

-- ── dispute_messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_messages (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  uuid  NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id   uuid  NOT NULL REFERENCES users(id),
  role        text  NOT NULL CHECK (role IN ('customer','cook','admin')),
  message     text  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispute_msg_dispute ON dispute_messages(dispute_id);

-- ── escrow_holds ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_holds (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid    NOT NULL REFERENCES orders(id) UNIQUE,
  amount          numeric(12,2) NOT NULL,
  status          text    NOT NULL DEFAULT 'held' CHECK (status IN (
    'held','released','refunded','partial_refund'
  )),
  held_at         timestamptz NOT NULL DEFAULT NOW(),
  released_at     timestamptz,
  payout_blocked  boolean NOT NULL DEFAULT false,
  flw_tx_ref      text,
  refund_amount   numeric(12,2),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_escrow_order  ON escrow_holds(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_holds(status);

-- ── catering_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catering_events (
  id                    uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid  NOT NULL REFERENCES users(id),
  cook_id               uuid  REFERENCES cook_profiles(id),
  event_name            text,
  event_type            text  NOT NULL CHECK (event_type IN (
    'wedding','birthday','corporate','funeral',
    'naming','graduation','anniversary','other'
  )),
  event_date            date  NOT NULL,
  event_time            time,
  guest_count           int   NOT NULL CHECK (guest_count > 0),
  venue_address         text  NOT NULL,
  venue_latitude        numeric(10,7),
  venue_longitude       numeric(10,7),
  menu_description      text,
  dietary_requirements  text,
  equipment_needed      boolean NOT NULL DEFAULT false,
  service_staff_needed  boolean NOT NULL DEFAULT false,
  status                text  NOT NULL DEFAULT 'enquiry' CHECK (status IN (
    'enquiry','quoted','accepted','deposit_paid',
    'in_progress','completed','cancelled','disputed'
  )),
  quote_amount          numeric(12,2),
  deposit_amount        numeric(12,2) NOT NULL DEFAULT 0,
  deposit_paid_at       timestamptz,
  deposit_tx_ref        text,
  deposit_transaction_id text,
  final_amount          numeric(12,2),
  final_paid_at         timestamptz,
  final_tx_ref          text,
  timeline              jsonb NOT NULL DEFAULT '[]',
  quote_message         text,
  quoted_at             timestamptz,
  invoice_url           text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_catering_customer ON catering_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_catering_cook     ON catering_events(cook_id);
CREATE INDEX IF NOT EXISTS idx_catering_status   ON catering_events(status);
CREATE INDEX IF NOT EXISTS idx_catering_date     ON catering_events(event_date);

-- ── courses ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id          uuid    NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  title            text    NOT NULL,
  description      text,
  cover_image      text,
  price            numeric(12,2) NOT NULL DEFAULT 0,
  currency         text    NOT NULL DEFAULT 'NGN',
  difficulty_level text    CHECK (difficulty_level IN ('beginner','intermediate','advanced')),
  duration_hours   numeric(5,1),
  lesson_count     int     NOT NULL DEFAULT 0,
  category         text,
  tags             text[]  NOT NULL DEFAULT '{}',
  is_published     boolean NOT NULL DEFAULT false,
  is_free          boolean NOT NULL DEFAULT false,
  enrollment_count int     NOT NULL DEFAULT 0,
  rating           numeric(3,2) NOT NULL DEFAULT 0,
  lessons          jsonb   NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courses_cook      ON courses(cook_id);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_courses_search    ON courses
  USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- ── course_enrollments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_enrollments (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    uuid    NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id      uuid    NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tx_ref       text,
  amount_paid  numeric(12,2),
  progress     int     NOT NULL DEFAULT 0,
  completed    boolean NOT NULL DEFAULT false,
  enrolled_at  timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  UNIQUE (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_user   ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments(course_id);

-- ── digital_products ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_products (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id        uuid    NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  type           text    NOT NULL CHECK (type IN (
    'recipe_book','meal_plan','cookbook','nutrition_guide',
    'shopping_list','kitchen_guide','other'
  )),
  title          text    NOT NULL,
  description    text,
  cover_image    text,
  file_url       text,
  preview_url    text,
  price          numeric(12,2) NOT NULL DEFAULT 0,
  currency       text    NOT NULL DEFAULT 'NGN',
  is_published   boolean NOT NULL DEFAULT false,
  download_count int     NOT NULL DEFAULT 0,
  page_count     int,
  tags           text[]  NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_digprod_cook      ON digital_products(cook_id);
CREATE INDEX IF NOT EXISTS idx_digprod_published ON digital_products(is_published) WHERE is_published = true;

-- ── digital_product_purchases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_product_purchases (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid    NOT NULL REFERENCES digital_products(id) ON DELETE CASCADE,
  user_id      uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_ref       text,
  amount_paid  numeric(12,2),
  purchased_at timestamptz NOT NULL DEFAULT NOW(),
  download_url text,
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_digpurchase_user ON digital_product_purchases(user_id);

-- ── weekly_menus ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_menus (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id      uuid    NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  week_start   date    NOT NULL,
  title        text,
  description  text,
  items        jsonb   NOT NULL DEFAULT '[]',
  is_published boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (cook_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_menu_cook ON weekly_menus(cook_id);

-- ── invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text  UNIQUE NOT NULL,
  cook_id        uuid  NOT NULL REFERENCES cook_profiles(id),
  customer_id    uuid  NOT NULL REFERENCES users(id),
  order_id       uuid  REFERENCES orders(id),
  catering_id    uuid  REFERENCES catering_events(id),
  line_items     jsonb NOT NULL DEFAULT '[]',
  subtotal       numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount     numeric(12,2) NOT NULL DEFAULT 0,
  total          numeric(12,2) NOT NULL,
  currency       text  NOT NULL DEFAULT 'NGN',
  status         text  NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','sent','paid','overdue','cancelled','partial'
  )),
  due_date       date,
  paid_at        timestamptz,
  paid_amount    numeric(12,2) NOT NULL DEFAULT 0,
  tx_ref         text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_cook     ON invoices(cook_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);

-- ── quotations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number   text  UNIQUE NOT NULL,
  cook_id        uuid  NOT NULL REFERENCES cook_profiles(id),
  customer_id    uuid  NOT NULL REFERENCES users(id),
  title          text,
  line_items     jsonb NOT NULL DEFAULT '[]',
  subtotal       numeric(12,2) NOT NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total          numeric(12,2) NOT NULL,
  currency       text  NOT NULL DEFAULT 'NGN',
  status         text  NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','sent','accepted','rejected','expired','converted'
  )),
  valid_until    date,
  notes          text,
  invoice_id     uuid  REFERENCES invoices(id),
  converted_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotes_cook     ON quotations(cook_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotations(customer_id);

-- ── creator_subscription_tiers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_subscription_tiers (
  id             uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id        uuid  NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  name           text  NOT NULL,
  price          numeric(12,2) NOT NULL,
  billing_period text  NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly','quarterly','yearly')),
  benefits       text[] NOT NULL DEFAULT '{}',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_tiers_cook ON creator_subscription_tiers(cook_id);

-- ── creator_subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id       uuid  NOT NULL REFERENCES creator_subscription_tiers(id) ON DELETE CASCADE,
  subscriber_id uuid  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cook_id       uuid  NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  status        text  NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','cancelled','expired','paused')),
  started_at    timestamptz NOT NULL DEFAULT NOW(),
  expires_at    timestamptz,
  tx_ref        text,
  amount_paid   numeric(12,2),
  UNIQUE (tier_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_creator_subs_subscriber ON creator_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_creator_subs_cook       ON creator_subscriptions(cook_id);

-- ── affiliate_links ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_links (
  id               uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id          uuid  NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  code             text  UNIQUE NOT NULL,
  url              text  NOT NULL,
  title            text,
  description      text,
  commission_rate  numeric(5,2) NOT NULL DEFAULT 0,
  click_count      int   NOT NULL DEFAULT 0,
  conversion_count int   NOT NULL DEFAULT 0,
  earnings         numeric(12,2) NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  expires_at       date,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_cook ON affiliate_links(cook_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_code ON affiliate_links(code);

-- ── Full-text search indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_menu_fts  ON menu_items
  USING gin(to_tsvector('english',
    coalesce(title,'') || ' ' || coalesce(description,'')));

CREATE INDEX IF NOT EXISTS idx_cook_fts  ON cook_profiles
  USING gin(to_tsvector('english',
    coalesce(display_name,'') || ' ' || coalesce(bio,'')));

CREATE INDEX IF NOT EXISTS idx_post_fts  ON cook_diary_posts
  USING gin(to_tsvector('english',
    coalesce(body,'')));

-- ── Sequence helpers for invoice/quote numbers ────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq   START 1000;
