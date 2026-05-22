-- ============================================================
-- FOODSbyme Migration 012: Critical bug fixes
-- C1: users.full_name NOT NULL prevents new user registration
-- C2: Unify order status vocabulary across DB / backend / frontend
-- C3: Add removed_sides column to orders (missing from schema)
-- C4: claim_slot / claim_realtime_slot accept quantity parameter
-- ============================================================

-- C1: Allow users to be created with phone only (name collected later)
ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL;


-- C2: Unify order status vocabulary
-- Migrate any rows using old vocabulary before changing the constraint.
UPDATE orders SET status = 'payment_confirmed' WHERE status IN ('paid', 'confirmed');
UPDATE orders SET status = 'out_for_delivery'  WHERE status IN ('rider_assigned', 'picked_up');

-- Drop old constraint (inline check constraints are auto-named by Postgres)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending_payment',   -- order created, awaiting payment
  'payment_confirmed', -- Flutterwave webhook confirmed payment
  'accepted',          -- cook accepted the order
  'preparing',         -- cook started cooking
  'ready',             -- food ready, photo uploaded
  'out_for_delivery',  -- rider assigned / picked up
  'in_transit',        -- rider on the way
  'delivered',         -- delivered to customer
  'completed',         -- customer confirmed receipt
  'cancelled',         -- cancelled by customer / cook / system
  'refunded'           -- payment refunded
));


-- C3: Add removed_sides column (frontend sends this, column was missing)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS removed_sides jsonb DEFAULT '[]';


-- C4: claim_slot — accept quantity so multi-quantity orders work atomically
CREATE OR REPLACE FUNCTION claim_slot(p_menu_item_id uuid, p_quantity integer DEFAULT 1)
RETURNS boolean AS $$
DECLARE
  v_total   integer;
  v_claimed integer;
BEGIN
  SELECT total_slots, slots_claimed
  INTO v_total, v_claimed
  FROM menu_items
  WHERE id = p_menu_item_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF (v_claimed + p_quantity) > v_total THEN
    RETURN false;
  END IF;

  UPDATE menu_items
  SET slots_claimed = slots_claimed + p_quantity,
      updated_at    = now()
  WHERE id = p_menu_item_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION claim_realtime_slot(p_menu_item_id uuid, p_quantity integer DEFAULT 1)
RETURNS boolean AS $$
DECLARE
  v_total     integer;
  v_claimed   integer;
  v_available boolean;
BEGIN
  SELECT realtime_slots, realtime_slots_claimed, realtime_available
  INTO v_total, v_claimed, v_available
  FROM menu_items
  WHERE id = p_menu_item_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND OR NOT v_available THEN
    RETURN false;
  END IF;

  IF (v_claimed + p_quantity) > v_total THEN
    RETURN false;
  END IF;

  UPDATE menu_items
  SET realtime_slots_claimed = realtime_slots_claimed + p_quantity,
      updated_at             = now()
  WHERE id = p_menu_item_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
