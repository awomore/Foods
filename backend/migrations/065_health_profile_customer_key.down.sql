ALTER TABLE customer_health_profiles
  DROP CONSTRAINT IF EXISTS customer_health_profiles_customer_id_fkey;
ALTER TABLE customer_health_profiles
  DROP CONSTRAINT IF EXISTS customer_health_profiles_customer_id_key;
