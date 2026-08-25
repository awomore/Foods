-- Logging in could orphan an account.
--
-- routes/auth.js looked the user up with a bare equality on the phone column,
-- using the raw request string. A row stored '08020745675' was invisible to an
-- app sending '2348020745675', so verify-otp fell through to its INSERT and made
-- a SECOND account; the original — profile, role, orders and all — was still
-- there but no longer addressable by anyone who logged in the other way.
--
-- The lookup now matches on the national significant number: the last ten
-- digits, the longest suffix every spelling of a number shares. This index is
-- what keeps that lookup off a sequential scan of users on the login path.
--
-- Ten, not nine: 0802 074 5675 and 0902 074 5675 share their last nine digits
-- and are two different subscribers, so a nine-digit key would hand one person's
-- account to another. See utils/phone.js.
--
-- The 10 is written as a literal here and in the queries that use it. Postgres
-- only chooses an expression index when the query expression matches it
-- literally, so a bound parameter would silently cost the index.
--
-- NOT unique, deliberately: duplicate accounts created by the old behaviour
-- already exist, so a unique index would fail to build and take the deploy down
-- with it. Merging those rows is a data decision, not a migration —
-- scripts/phone-collisions.js reports them.

CREATE INDEX IF NOT EXISTS idx_users_phone_national
  ON users (RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10));
