-- ── Health Kitchen V2 ────────────────────────────────────────────────────────
-- Adds: credential fields, unified specialisation list, meal plans,
--       plan subscriptions, feeding history consent

-- 1. Cook credential fields
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS health_credential_type    TEXT CHECK (health_credential_type IN ('nutritionist','dietician','health_cook')),
  ADD COLUMN IF NOT EXISTS health_credential_number  TEXT,
  ADD COLUMN IF NOT EXISTS health_credential_verified BOOLEAN DEFAULT FALSE;

-- 2. Fix customer_health_profiles — add missing columns the route already expects
ALTER TABLE customer_health_profiles
  ADD COLUMN IF NOT EXISTS allergens            TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dietary_preferences  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conditions           TEXT[] DEFAULT '{}';

-- 3. Unify specialisation CHECK constraint
--    Drop the old constraint (name may vary) then re-add with full list
ALTER TABLE cook_health_specialisations
  DROP CONSTRAINT IF EXISTS cook_health_specialisations_specialisation_check;

ALTER TABLE cook_health_specialisations
  ADD CONSTRAINT cook_health_specialisations_specialisation_check
  CHECK (specialisation IN (
    'diabetes','weight_loss','heart_health','pregnancy','postpartum',
    'child_nutrition','keto','low_sodium','high_protein','gut_health',
    'anti_inflammatory','general_wellness','vegan','vegetarian',
    'gluten_free','dairy_free','halal','low_carb'
  ));

-- 4. Health meal plans (sellable plans by health kitchen creators)
CREATE TABLE IF NOT EXISTS health_meal_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  target_condition TEXT,
  duration_weeks   INTEGER NOT NULL DEFAULT 4,
  meals_per_day    INTEGER NOT NULL DEFAULT 3,
  price            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'NGN',
  is_published     BOOLEAN DEFAULT FALSE,
  subscriber_count INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 5. Meal plan items (daily meal entries per plan)
CREATE TABLE IF NOT EXISTS health_meal_plan_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID NOT NULL REFERENCES health_meal_plans(id) ON DELETE CASCADE,
  week_number         INTEGER NOT NULL DEFAULT 1,
  day_number          INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  meal_type           TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  title               TEXT NOT NULL,
  description         TEXT,
  calories            INTEGER,
  protein_g           NUMERIC(6,1),
  carbs_g             NUMERIC(6,1),
  fat_g               NUMERIC(6,1),
  linked_menu_item_id UUID REFERENCES menu_items(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- 6. Health plan subscriptions (user subscribes to a plan)
CREATE TABLE IF NOT EXISTS health_plan_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  plan_id      UUID NOT NULL REFERENCES health_meal_plans(id),
  creator_id   UUID NOT NULL REFERENCES cook_profiles(id),
  status       TEXT DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  started_at   TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE (user_id, plan_id)
);

-- 7. Feeding history consent
--    User grants a specific health kitchen creator read access to their order history
CREATE TABLE IF NOT EXISTS health_data_consent (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  creator_id UUID NOT NULL REFERENCES cook_profiles(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  is_active  BOOLEAN DEFAULT TRUE,
  UNIQUE (user_id, creator_id)
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_health_meal_plans_creator ON health_meal_plans(creator_id);
CREATE INDEX IF NOT EXISTS idx_health_meal_plan_items_plan ON health_meal_plan_items(plan_id, week_number, day_number);
CREATE INDEX IF NOT EXISTS idx_health_plan_subs_user ON health_plan_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_health_plan_subs_creator ON health_plan_subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_health_data_consent_user ON health_data_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_health_data_consent_creator ON health_data_consent(creator_id, is_active);
