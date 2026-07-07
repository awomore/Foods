-- Reverse 052 — drop the otp_required column from cook_profiles.
ALTER TABLE cook_profiles DROP COLUMN IF EXISTS otp_required;
