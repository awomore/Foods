-- ============================================================
-- FOODSbyme Migration 004: weekly_meal_plans and menu_items
-- The menu system — cooks publish weekly plans, items have slots.
-- ============================================================

CREATE TABLE weekly_meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  week_start_date date NOT NULL,          -- always a Monday
  published_at timestamptz,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (cook_id, week_start_date)
);

CREATE TABLE menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  meal_plan_id uuid REFERENCES weekly_meal_plans(id),  -- null for store items
  mode text NOT NULL CHECK (mode IN ('meals', 'drinks', 'bakery', 'store')),
  title text NOT NULL,
  description text,
  cook_note text,                         -- personal note e.g. "I've been making this since 5am"
  cuisine_type text,                      -- e.g. 'Yoruba', 'Igbo', 'Continental'
  ethnic_tags text[],                     -- e.g. {'Delta', 'Southeast', 'Hausa'}
  ingredients text[],
  allergens text[],                       -- nuts, gluten, dairy, shellfish, eggs, soy, fish, sesame
  photos text[] NOT NULL,                 -- min 1 Supabase Storage URL
  unit_price decimal NOT NULL CHECK (unit_price > 0),
  
  -- Sides / add-ons
  sides jsonb DEFAULT '[]',
  -- [{"name":"Eba","optional":true,"price":0},{"name":"Extra meat","optional":true,"price":500}]
  
  -- Slot management (pre-order)
  total_slots integer NOT NULL DEFAULT 10,
  slots_claimed integer DEFAULT 0,
  available_date date,                    -- the day this item is available
  delivery_window_start timestamptz,
  delivery_window_end timestamptz,
  
  -- Real-time availability
  realtime_available boolean DEFAULT false,
  realtime_slots integer DEFAULT 0,
  realtime_slots_claimed integer DEFAULT 0,
  
  -- Special flags
  is_surprise_drop boolean DEFAULT false, -- visible only to subscribers/regulars
  is_gold_early_access boolean DEFAULT false, -- Gold members see 30min early
  gold_early_access_until timestamptz,
  is_active boolean DEFAULT true,
  
  -- Store items (always listed, inventory tracked)
  is_store_item boolean DEFAULT false,
  store_inventory integer,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for discovery
CREATE INDEX idx_menu_date ON menu_items(available_date) WHERE is_active = true;
CREATE INDEX idx_menu_realtime ON menu_items(realtime_available) 
  WHERE realtime_available = true AND is_active = true;
CREATE INDEX idx_menu_cuisine ON menu_items(cuisine_type);
CREATE INDEX idx_menu_cook ON menu_items(cook_id);
CREATE INDEX idx_menu_mode ON menu_items(mode);
