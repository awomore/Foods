-- 057: the twelve marketplace tables that existed only by hand
--
-- These tables were created directly against the development database (Neon) and
-- never written as a migration, so they never reached the Railway production
-- database. Every endpoint below therefore 500s in production while working
-- locally: invoices, quotations, creator subscriptions, gift cards, group gifts,
-- health kitchen subscriptions, digital product purchases, affiliate links, bulk
-- requests, and the cook verification log.
--
-- The DDL is reconstructed from the live development schema (pg_catalog:
-- format_type + pg_get_constraintdef + pg_get_indexdef), so column types,
-- defaults, checks, foreign keys and indexes match what the code has been
-- running against — this is not a fresh guess at the shape.
--
-- Every statement is guarded (IF NOT EXISTS, and all constraints are inline in
-- CREATE TABLE rather than bare ADD CONSTRAINT), so re-running against a database
-- that already has them is a no-op. That matters here: migrations 024/044/046
-- used unguarded ADD CONSTRAINT and are why replaying migrations fails.
--
-- Order is dependency-first: invoices before quotations, tiers before
-- subscriptions, group_gifts before its contributions.

CREATE TABLE IF NOT EXISTS invoices (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  invoice_number         text NOT NULL,
  cook_id                uuid NOT NULL,
  customer_id            uuid NOT NULL,
  order_id               uuid,
  catering_id            uuid,
  line_items             jsonb DEFAULT '[]'::jsonb NOT NULL,
  subtotal               numeric(12,2) NOT NULL,
  discount_amount        numeric(12,2) DEFAULT 0 NOT NULL,
  tax_amount             numeric(12,2) DEFAULT 0 NOT NULL,
  total                  numeric(12,2) NOT NULL,
  currency               text DEFAULT 'NGN'::text NOT NULL,
  status                 text DEFAULT 'draft'::text NOT NULL,
  due_date               date,
  paid_at                timestamptz,
  paid_amount            numeric(12,2) DEFAULT 0 NOT NULL,
  tx_ref                 text,
  notes                  text,
  created_at             timestamptz DEFAULT now() NOT NULL,
  updated_at             timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number),
  CONSTRAINT invoices_catering_id_fkey FOREIGN KEY (catering_id) REFERENCES catering_events(id),
  CONSTRAINT invoices_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT invoices_status_check CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text, 'partial'::text]))
);
CREATE INDEX IF NOT EXISTS idx_invoices_cook     ON invoices USING btree (cook_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices USING btree (status);

CREATE TABLE IF NOT EXISTS quotations (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  quote_number           text NOT NULL,
  cook_id                uuid NOT NULL,
  customer_id            uuid NOT NULL,
  title                  text,
  line_items             jsonb DEFAULT '[]'::jsonb NOT NULL,
  subtotal               numeric(12,2) NOT NULL,
  discount_amount        numeric(12,2) DEFAULT 0 NOT NULL,
  total                  numeric(12,2) NOT NULL,
  currency               text DEFAULT 'NGN'::text NOT NULL,
  status                 text DEFAULT 'draft'::text NOT NULL,
  valid_until            date,
  notes                  text,
  invoice_id             uuid,
  converted_at           timestamptz,
  created_at             timestamptz DEFAULT now() NOT NULL,
  updated_at             timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT quotations_pkey PRIMARY KEY (id),
  CONSTRAINT quotations_quote_number_key UNIQUE (quote_number),
  CONSTRAINT quotations_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id),
  CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT quotations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT quotations_status_check CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'converted'::text]))
);
CREATE INDEX IF NOT EXISTS idx_quotes_cook     ON quotations USING btree (cook_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotations USING btree (customer_id);

CREATE TABLE IF NOT EXISTS creator_subscription_tiers (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  cook_id                uuid NOT NULL,
  name                   text NOT NULL,
  price                  numeric(12,2) NOT NULL,
  billing_period         text DEFAULT 'monthly'::text NOT NULL,
  benefits               text[] DEFAULT '{}'::text[] NOT NULL,
  is_active              boolean DEFAULT true NOT NULL,
  created_at             timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT creator_subscription_tiers_pkey PRIMARY KEY (id),
  CONSTRAINT creator_subscription_tiers_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE,
  CONSTRAINT creator_subscription_tiers_billing_period_check CHECK (billing_period = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text]))
);
CREATE INDEX IF NOT EXISTS idx_sub_tiers_cook ON creator_subscription_tiers USING btree (cook_id);

CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  tier_id                uuid NOT NULL,
  subscriber_id          uuid NOT NULL,
  cook_id                uuid NOT NULL,
  status                 text DEFAULT 'active'::text NOT NULL,
  started_at             timestamptz DEFAULT now() NOT NULL,
  expires_at             timestamptz,
  tx_ref                 text,
  amount_paid            numeric(12,2),
  CONSTRAINT creator_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT creator_subscriptions_tier_id_subscriber_id_key UNIQUE (tier_id, subscriber_id),
  CONSTRAINT creator_subscriptions_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE,
  CONSTRAINT creator_subscriptions_subscriber_id_fkey FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT creator_subscriptions_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES creator_subscription_tiers(id) ON DELETE CASCADE,
  CONSTRAINT creator_subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text, 'paused'::text]))
);
CREATE INDEX IF NOT EXISTS idx_creator_subs_cook       ON creator_subscriptions USING btree (cook_id);
CREATE INDEX IF NOT EXISTS idx_creator_subs_subscriber ON creator_subscriptions USING btree (subscriber_id);

CREATE TABLE IF NOT EXISTS gift_cards (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  code                   text NOT NULL,
  denomination           numeric NOT NULL,
  balance                numeric NOT NULL,
  purchased_by           uuid NOT NULL,
  redeemed_by            uuid,
  recipient_phone        text,
  recipient_email        text,
  gift_message           text,
  delivery_method        text,
  is_redeemed            boolean DEFAULT false,
  expires_at             timestamptz NOT NULL,
  flutterwave_tx_ref     text,
  created_at             timestamptz DEFAULT now(),
  CONSTRAINT gift_cards_pkey PRIMARY KEY (id),
  CONSTRAINT gift_cards_code_key UNIQUE (code),
  CONSTRAINT gift_cards_purchased_by_fkey FOREIGN KEY (purchased_by) REFERENCES users(id),
  CONSTRAINT gift_cards_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES users(id),
  CONSTRAINT gift_cards_delivery_method_check CHECK (delivery_method = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text])),
  CONSTRAINT gift_cards_denomination_check CHECK (denomination = ANY (ARRAY[(2500)::numeric, (5000)::numeric, (10000)::numeric, (20000)::numeric]))
);

CREATE TABLE IF NOT EXISTS group_gifts (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  initiator_id           uuid NOT NULL,
  recipient_name         text NOT NULL,
  recipient_phone        text NOT NULL,
  recipient_address      text,
  menu_item_id           uuid,
  cook_id                uuid,
  target_amount          numeric NOT NULL,
  current_amount         numeric DEFAULT 0,
  message                text,
  status                 text DEFAULT 'open'::text,
  share_link             text,
  expires_at             timestamptz,
  created_at             timestamptz DEFAULT now(),
  CONSTRAINT group_gifts_pkey PRIMARY KEY (id),
  CONSTRAINT group_gifts_share_link_key UNIQUE (share_link),
  CONSTRAINT group_gifts_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id),
  CONSTRAINT group_gifts_initiator_id_fkey FOREIGN KEY (initiator_id) REFERENCES users(id),
  CONSTRAINT group_gifts_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  CONSTRAINT group_gifts_status_check CHECK (status = ANY (ARRAY['open'::text, 'funded'::text, 'ordered'::text, 'delivered'::text, 'expired'::text]))
);

CREATE TABLE IF NOT EXISTS group_gift_contributions (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  group_gift_id          uuid NOT NULL,
  contributor_id         uuid,
  contributor_name       text,
  amount                 numeric NOT NULL,
  flutterwave_tx_ref     text,
  created_at             timestamptz DEFAULT now(),
  CONSTRAINT group_gift_contributions_pkey PRIMARY KEY (id),
  CONSTRAINT group_gift_contributions_contributor_id_fkey FOREIGN KEY (contributor_id) REFERENCES users(id),
  CONSTRAINT group_gift_contributions_group_gift_id_fkey FOREIGN KEY (group_gift_id) REFERENCES group_gifts(id),
  CONSTRAINT group_gift_contributions_amount_check CHECK (amount > (0)::numeric)
);

-- Distinct from health_plan_subscriptions (user↔plan) and meal_subscriptions
-- (a paid weekly plan): this is a customer following a kitchen's health feed.
CREATE TABLE IF NOT EXISTS health_subscriptions (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  customer_id            uuid NOT NULL,
  cook_id                uuid NOT NULL,
  status                 text DEFAULT 'active'::text,
  started_at             timestamptz DEFAULT now(),
  cancelled_at           timestamptz,
  CONSTRAINT health_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT health_subscriptions_customer_id_cook_id_key UNIQUE (customer_id, cook_id),
  CONSTRAINT health_subscriptions_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id),
  CONSTRAINT health_subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customer_profiles(id),
  CONSTRAINT health_subscriptions_status_check CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text]))
);

CREATE TABLE IF NOT EXISTS digital_product_purchases (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  product_id             uuid NOT NULL,
  user_id                uuid NOT NULL,
  tx_ref                 text,
  amount_paid            numeric(12,2),
  purchased_at           timestamptz DEFAULT now() NOT NULL,
  download_url           text,
  CONSTRAINT digital_product_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT digital_product_purchases_product_id_user_id_key UNIQUE (product_id, user_id),
  CONSTRAINT digital_product_purchases_product_id_fkey FOREIGN KEY (product_id) REFERENCES digital_products(id) ON DELETE CASCADE,
  CONSTRAINT digital_product_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_digpurchase_user ON digital_product_purchases USING btree (user_id);

CREATE TABLE IF NOT EXISTS affiliate_links (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  cook_id                uuid NOT NULL,
  code                   text NOT NULL,
  url                    text NOT NULL,
  title                  text,
  description            text,
  commission_rate        numeric(5,2) DEFAULT 0 NOT NULL,
  click_count            integer DEFAULT 0 NOT NULL,
  conversion_count       integer DEFAULT 0 NOT NULL,
  earnings               numeric(12,2) DEFAULT 0 NOT NULL,
  is_active              boolean DEFAULT true NOT NULL,
  expires_at             date,
  created_at             timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT affiliate_links_pkey PRIMARY KEY (id),
  CONSTRAINT affiliate_links_code_key UNIQUE (code),
  CONSTRAINT affiliate_links_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_affiliate_code ON affiliate_links USING btree (code);
CREATE INDEX IF NOT EXISTS idx_affiliate_cook ON affiliate_links USING btree (cook_id);

CREATE TABLE IF NOT EXISTS bulk_requests (
  id                      uuid DEFAULT gen_random_uuid() NOT NULL,
  customer_id             uuid NOT NULL,
  cook_id                 uuid NOT NULL,
  description             text NOT NULL,
  serving_count           integer NOT NULL,
  preferred_date          date NOT NULL,
  delivery_address        text,
  delivery_latitude       numeric,
  delivery_longitude      numeric,
  status                  text DEFAULT 'pending'::text,
  quote_amount            numeric,
  quote_message           text,
  quoted_at               timestamptz,
  deposit_amount          numeric,
  deposit_percentage      integer DEFAULT 50,
  deposit_paid            boolean DEFAULT false,
  balance_amount          numeric,
  balance_paid            boolean DEFAULT false,
  flutterwave_deposit_ref text,
  flutterwave_balance_ref text,
  created_at              timestamptz DEFAULT now(),
  CONSTRAINT bulk_requests_pkey PRIMARY KEY (id),
  CONSTRAINT bulk_requests_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id),
  CONSTRAINT bulk_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT bulk_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'quoted'::text, 'deposit_paid'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]))
);

CREATE TABLE IF NOT EXISTS cook_verification_log (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  cook_id                uuid NOT NULL,
  action                 text NOT NULL,
  details                text,
  performed_by           uuid,
  created_at             timestamptz DEFAULT now(),
  CONSTRAINT cook_verification_log_pkey PRIMARY KEY (id),
  CONSTRAINT cook_verification_log_cook_id_fkey FOREIGN KEY (cook_id) REFERENCES cook_profiles(id),
  CONSTRAINT cook_verification_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id),
  CONSTRAINT cook_verification_log_action_check CHECK (action = ANY (ARRAY['approved'::text, 'suspended'::text, 'reinstated'::text, 'went_dark'::text, 'nafdac_reminder_15'::text, 'nafdac_reminder_25'::text, 'nafdac_auto_suspended'::text, 'report_filed'::text, 'report_resolved'::text, 'annual_reverification'::text]))
);
