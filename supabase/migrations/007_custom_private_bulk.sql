-- ============================================================
-- FOODSbyme Migration 007: custom requests, private chef, bulk orders
-- Three special order types beyond standard pre-order/real-time.
-- ============================================================

-- Custom requests (customer asks cook for something specific)
CREATE TABLE custom_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  description text NOT NULL,
  photos text[],                          -- reference photos from customer
  serving_count integer,
  preferred_date date,
  budget_range text,                      -- e.g. "₦3,000 - ₦5,000"
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'quoted', 'accepted', 'declined', 'cancelled', 'completed'
  )),
  -- Cook's quote
  quote_amount decimal,
  quote_message text,
  quoted_at timestamptz,
  -- Linked order (created when customer accepts quote)
  order_id uuid REFERENCES orders(id),
  created_at timestamptz DEFAULT now()
);

-- Private chef bookings
CREATE TABLE private_chef_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  event_type text,                        -- e.g. 'birthday', 'dinner party', 'corporate'
  event_date date NOT NULL,
  event_time time,
  guest_count integer NOT NULL,
  venue_address text NOT NULL,
  venue_latitude decimal,
  venue_longitude decimal,
  description text,
  dietary_requirements text,
  status text DEFAULT 'enquiry' CHECK (status IN (
    'enquiry', 'quoted', 'deposit_paid', 'confirmed', 'completed', 'cancelled'
  )),
  -- Quote
  quote_amount decimal,
  quote_breakdown jsonb,                  -- [{item, amount}]
  quote_message text,
  quoted_at timestamptz,
  -- Payment
  deposit_amount decimal,
  deposit_paid boolean DEFAULT false,
  balance_amount decimal,
  balance_paid boolean DEFAULT false,
  flutterwave_deposit_ref text,
  flutterwave_balance_ref text,
  created_at timestamptz DEFAULT now()
);

-- Bulk requests (large orders, often institutional)
CREATE TABLE bulk_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  description text NOT NULL,
  serving_count integer NOT NULL,
  preferred_date date NOT NULL,
  delivery_address text,
  delivery_latitude decimal,
  delivery_longitude decimal,
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'quoted', 'deposit_paid', 'confirmed', 'completed', 'cancelled'
  )),
  -- Quote
  quote_amount decimal,
  quote_message text,
  quoted_at timestamptz,
  -- Payment
  deposit_amount decimal,
  deposit_percentage integer DEFAULT 50,
  deposit_paid boolean DEFAULT false,
  balance_amount decimal,
  balance_paid boolean DEFAULT false,
  flutterwave_deposit_ref text,
  flutterwave_balance_ref text,
  created_at timestamptz DEFAULT now()
);
