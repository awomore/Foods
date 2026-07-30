-- Down for 063. Widening back to text always succeeds — every time value has a
-- text representation — but it re-opens the column to invalid input.

ALTER TABLE catering_events
  ALTER COLUMN event_time TYPE text USING event_time::text;
ALTER TABLE private_chef_bookings
  ALTER COLUMN event_time TYPE text USING event_time::text;
