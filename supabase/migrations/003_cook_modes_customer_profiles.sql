-- ============================================================
-- FOODSbyme Migration 003: cook_modes, customer profiles, health
-- ============================================================

-- Cook can enable multiple modes: meals, drinks, bakery, store, private_chef
CREATE TABLE cook_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  mode text NOT NULL CHECK (mode IN ('meals', 'drinks', 'bakery', 'store', 'private_chef')),
  is_enabled boolean DEFAULT false,
  UNIQUE (cook_id, mode)
);

-- Health Kitchen specialisations (for approved health cooks)
CREATE TABLE cook_health_specialisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  specialisation text NOT NULL CHECK (specialisation IN (
    'diabetes', 'weight_loss', 'heart_health', 'pregnancy',
    'postpartum', 'child_nutrition', 'keto', 'low_sodium',
    'high_protein', 'gut_health', 'anti_inflammatory', 'general_wellness'
  )),
  UNIQUE (cook_id, specialisation)
);

-- Customer dietary profile (mandatory at onboarding)
CREATE TABLE customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) UNIQUE NOT NULL,
  -- Allergens: multi-select from standard list
  allergens text[] DEFAULT '{}',
  -- Dislikes: free-text tags e.g. {'offal', 'very spicy', 'fermented'}
  dislikes text[] DEFAULT '{}',
  -- Dietary type
  dietary_type text DEFAULT 'none'
    CHECK (dietary_type IN ('none', 'vegetarian', 'vegan', 'halal', 'kosher', 'pescatarian')),
  -- Delivery address
  default_address text,
  default_address_label text DEFAULT 'Home'
    CHECK (default_address_label IN ('Home', 'Office', 'Other')),
  default_latitude decimal,
  default_longitude decimal,
  -- Saved addresses
  saved_addresses jsonb DEFAULT '[]',
  -- [{"label":"Office","address":"...","lat":6.45,"lng":3.42}]
  
  -- Flash sale opt-in (last pot alerts)
  flash_opt_in boolean DEFAULT true,
  
  -- Gold membership
  is_gold boolean DEFAULT false,
  gold_started_at timestamptz,
  gold_expires_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- Customer health profile (optional)
CREATE TABLE customer_health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customer_profiles(id) UNIQUE NOT NULL,
  health_goals text[] DEFAULT '{}',
  -- e.g. {'weight_loss', 'manage_diabetes', 'eat_cleaner'}
  health_notes text,                      -- free text for cook
  is_visible_to_cooks boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Health subscriptions (customer subscribes to a Health Kitchen cook)
CREATE TABLE health_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customer_profiles(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE (customer_id, cook_id)
);

-- General cook subscriptions (any customer can subscribe to any cook)
CREATE TABLE cook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customer_profiles(id) NOT NULL,
  cook_id uuid REFERENCES cook_profiles(id) NOT NULL,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled')),
  notify_new_menu boolean DEFAULT true,
  notify_diary_post boolean DEFAULT true,
  notify_surprise_drop boolean DEFAULT true,
  started_at timestamptz DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE (customer_id, cook_id)
);
