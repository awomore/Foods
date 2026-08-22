-- customer_health_profiles could never be written through the API.
--
-- routes/health.js upserts with ON CONFLICT (customer_id), but 058 added
-- customer_id as a bare nullable uuid — no unique, no FK. Postgres validates an
-- ON CONFLICT target at PLAN time, so every call raised 42P10 whether or not a
-- conflicting row existed: PATCH /health/customer/profile returned 500 for every
-- customer, every time, and nobody could record an allergy.
--
-- Every query in the codebase keys on customer_id (health.js:21, :442, :501), so
-- customer_id is the real identity and this makes the constraint match the code.
-- user_id stays as the legacy column from 001 and is now populated alongside it.

-- 1. A health row whose user has no customer_profiles row cannot be given a
--    customer_id, and would later collide on the still-live UNIQUE (user_id).
INSERT INTO customer_profiles (user_id)
SELECT DISTINCT chp.user_id
  FROM customer_health_profiles chp
  LEFT JOIN customer_profiles cp ON cp.user_id = chp.user_id
 WHERE cp.id IS NULL AND chp.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2. Backfill, so pre-existing rows are reachable by the key the code uses.
UPDATE customer_health_profiles chp
   SET customer_id = cp.id
  FROM customer_profiles cp
 WHERE cp.user_id = chp.user_id
   AND chp.customer_id IS NULL;

-- 3. The constraint the code has always assumed. ADD CONSTRAINT has no
--    IF NOT EXISTS, so both are guarded.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'customer_health_profiles'::regclass
       AND conname  = 'customer_health_profiles_customer_id_key'
  ) THEN
    ALTER TABLE customer_health_profiles
      ADD CONSTRAINT customer_health_profiles_customer_id_key UNIQUE (customer_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'customer_health_profiles'::regclass
       AND conname  = 'customer_health_profiles_customer_id_fkey'
  ) THEN
    ALTER TABLE customer_health_profiles
      ADD CONSTRAINT customer_health_profiles_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customer_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
