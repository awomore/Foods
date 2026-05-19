-- ============================================================
-- FOODSbyme Migration 008: gifting, loyalty, gold, tips, discounts
-- ============================================================

-- Gift cards
CREATE TABLE gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  denomination decimal NOT NULL CHECK (denomination IN (2500, 5000, 10000, 20000)),
  balance decimal NOT NULL,
  purchased_by uuid REFERENCES users(id) NOT NULL,
  redeemed_by uuid REFERENCES users(id),
  recipient_phone text,
  recipient_email text,
  gift_message text,
  delivery_method text CHECK (delivery_method IN ('whatsapp', 'email', 'sms')),
  is_redeemed boolean DEFAULT false,
  expires_at timestamptz NOT NULL,        -- 12 months from purchase
  flutterwave_tx_ref text,
  created_at timestamptz DEFAULT now()
);

-- Group meal gifting
CREATE TABLE group_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id uuid REFERENCES users(id) NOT NULL,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_address text,
  menu_item_id uuid REFERENCES menu_items(id),
  cook_id uuid REFERENCES cook_profiles(id),
  target_amount decimal NOT NULL,
  current_amount decimal DEFAULT 0,
  message text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'funded', 'ordered', 'delivered', 'expired')),
  share_link text UNIQUE,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE group_gift_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_gift_id uuid REFERENCES group_gifts(id) NOT NULL,
  contributor_id uuid REFERENCES users(id),
  contributor_name text,
  amount decimal NOT NULL CHECK (amount > 0),
  flutterwave_tx_ref text,
  created_at timestamptz DEFAULT now()
);

-- Loyalty (Table Points)
CREATE TABLE loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) UNIQUE NOT NULL,
  balance integer DEFAULT 0,
  lifetime_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('earned', 'redeemed', 'donated', 'expired', 'bonus')),
  points integer NOT NULL,
  description text,
  order_id uuid REFERENCES orders(id),
  cook_id uuid REFERENCES cook_profiles(id),  -- for donations to cook's community pot
  created_at timestamptz DEFAULT now()
);

-- Tips
CREATE TABLE tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  order_id uuid REFERENCES orders(id),    -- null if spontaneous tip from profile
  amount decimal NOT NULL CHECK (amount > 0),
  cook_thank_you_note text,
  flutterwave_tx_ref text,
  created_at timestamptz DEFAULT now()
);

-- Cook-set discounts
CREATE TABLE cook_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  type text NOT NULL CHECK (type IN (
    'general_pct', 'general_delivery', 'loyalty_pct', 'loyalty_freeitem'
  )),
  discount_value decimal,
  min_orders_required integer DEFAULT 0,  -- for loyalty type
  free_item_description text,             -- for loyalty_freeitem type
  applies_to text DEFAULT 'all'
    CHECK (applies_to IN ('all', 'meals', 'bakery', 'drinks', 'store')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean DEFAULT true,
  claimed_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Wishlist (customer saves items)
CREATE TABLE wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  menu_item_id uuid REFERENCES menu_items(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (customer_id, menu_item_id)
);

-- Waitlist (customer wants to know when sold-out item returns)
CREATE TABLE waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  menu_item_id uuid REFERENCES menu_items(id) NOT NULL,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (customer_id, menu_item_id)
);
