-- ============================================================
-- FOODSbyme Migration 005: orders
-- The core transaction. Status transitions are validated server-side.
-- Valid flow: pending_payment → paid → confirmed → preparing → ready 
--             → rider_assigned → picked_up → in_transit → delivered
-- ============================================================

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES users(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  menu_item_id uuid REFERENCES menu_items(id) NOT NULL,
  
  order_type text NOT NULL CHECK (order_type IN ('preorder', 'realtime')),
  status text DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'paid', 'confirmed', 'preparing', 'ready',
    'rider_assigned', 'picked_up', 'in_transit', 'delivered',
    'cancelled', 'refunded'
  )),
  
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price decimal NOT NULL,
  subtotal decimal NOT NULL,              -- unit_price * quantity
  delivery_fee decimal DEFAULT 0,
  platform_fee decimal NOT NULL,          -- subtotal * 0.0375
  total_amount decimal NOT NULL,          -- subtotal + delivery_fee
  cook_payout decimal NOT NULL,           -- subtotal - platform_fee
  
  -- Selected sides
  selected_sides jsonb DEFAULT '[]',
  -- [{"name":"Eba","price":0},{"name":"Extra meat","price":500}]
  
  -- Delivery
  delivery_address text,
  delivery_latitude decimal,
  delivery_longitude decimal,
  delivery_window_start timestamptz,
  delivery_window_end timestamptz,
  
  -- Allergen acknowledgement
  allergen_acknowledged boolean DEFAULT false,
  matched_allergens text[],               -- set by allergenGuard at order creation
  
  -- Cook actions
  ready_photo_url text,                   -- cook uploads when food is ready
  ready_at timestamptz,
  
  -- Rider
  rider_tracking_id text,
  rider_name text,
  rider_phone text,
  estimated_arrival timestamptz,
  
  -- Completion
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by text CHECK (cancelled_by IN ('customer', 'cook', 'system', 'admin')),
  
  -- Payment
  flutterwave_tx_ref text,
  flutterwave_tx_id text,
  payment_method text,
  
  -- Refund
  refund_amount decimal,
  refund_reason text,
  refunded_at timestamptz,
  
  -- Payout tracking
  payout_status text DEFAULT 'pending' CHECK (payout_status IN (
    'pending', 'queued', 'processing', 'paid', 'failed'
  )),
  payout_batch_id text,
  paid_out_at timestamptz,
  
  -- Gift order
  is_gift boolean DEFAULT false,
  gift_recipient_name text,
  gift_recipient_phone text,
  gift_message text,
  
  -- Customer notes
  customer_note text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order items for multi-item orders (future-proof)
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) NOT NULL,
  menu_item_id uuid REFERENCES menu_items(id) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal NOT NULL,
  selected_sides jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_window ON orders(delivery_window_end);
CREATE INDEX idx_orders_cook ON orders(cook_id, status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_orders_payout ON orders(payout_status) WHERE payout_status = 'pending';
