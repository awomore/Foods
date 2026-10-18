ALTER TABLE rider_profiles
  DROP COLUMN IF EXISTS kyc_reviewed_at,
  DROP COLUMN IF EXISTS kyc_reviewed_by,
  DROP COLUMN IF EXISTS kyc_submitted_at,
  DROP COLUMN IF EXISTS kyc_document_id,
  DROP COLUMN IF EXISTS kyc_country;

UPDATE rider_profiles SET kyc_status = 'not_verified' WHERE kyc_status IN ('pending_review', 'rejected');
UPDATE rider_profiles SET kyc_type = NULL WHERE kyc_type IN ('national_id', 'passport');

ALTER TABLE rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_kyc_status_check;
ALTER TABLE rider_profiles ADD CONSTRAINT rider_profiles_kyc_status_check
  CHECK (kyc_status IN ('not_verified', 'verified', 'failed'));

ALTER TABLE rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_kyc_type_check;
ALTER TABLE rider_profiles ADD CONSTRAINT rider_profiles_kyc_type_check
  CHECK (kyc_type IN ('bvn', 'nin'));
