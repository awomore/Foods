-- 063: store event times as `time`, which is what the code already says they are
--
-- Closes the last of the five recorded cross-database type mismatches. Only two
-- of the five turned out to need a production change; the other three are cases
-- where **production is the correct side** and the development database is the
-- drifted one:
--
--   cook_profiles.open_time_default / close_time_default — TEXT here, matching
--     their declaration in 001. Nothing in the code casts them, and
--     open_hours_by_day (jsonb) carries the richer schedule. Left alone.
--   orders.payout_batch_id — uuid here, matching 001, and routes/earnings.js
--     passes the raw payout id straight in. Correct as-is.
--     (Note tips.payout_batch_id is text and earnings.js wraps that one in
--      String(). Inconsistent with orders, but self-consistent and unused —
--      not changed here, since nothing asks for it.)
--
-- What does need changing: catering_events.event_time and
-- private_chef_bookings.event_time are TEXT (001:892, 001:937), but both writers
-- insert `${event_time ?? null}::time` — routes/catering.js:32 and
-- routes/privateChef.js:25. That cast converts to a time and then straight back
-- to text for storage, so the declared type contradicts the only code that
-- writes it. Making the column `time` means the type enforces what the cast
-- currently has to, and a future write that forgets the cast cannot store
-- "sometime after lunch".
--
-- Both tables are EMPTY in production (verified before writing this), so the
-- USING clause has nothing to convert and the rewrite is free. The clause is
-- there for correctness if this is ever replayed against a populated database —
-- and it will reject a row that is not a valid time rather than silently
-- dropping it.
--
-- Guarded so replaying is a no-op instead of a pointless table rewrite.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catering_events'
      AND column_name = 'event_time' AND data_type = 'text'
  ) THEN
    ALTER TABLE catering_events
      ALTER COLUMN event_time TYPE time USING NULLIF(event_time, '')::time;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'private_chef_bookings'
      AND column_name = 'event_time' AND data_type = 'text'
  ) THEN
    ALTER TABLE private_chef_bookings
      ALTER COLUMN event_time TYPE time USING NULLIF(event_time, '')::time;
  END IF;
END $$;
