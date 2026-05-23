-- Add bank_code column for Flutterwave payouts
ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS bank_code text;
