-- Add platform fee tracking to catering deposits
ALTER TABLE catering_events
  ADD COLUMN IF NOT EXISTS deposit_platform_fee INTEGER DEFAULT 0;

-- Same for private chef bookings (parallel structure)
ALTER TABLE private_chef_bookings
  ADD COLUMN IF NOT EXISTS deposit_platform_fee INTEGER DEFAULT 0;
