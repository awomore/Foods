-- Riders verify with their own country's national ID (or a passport where no
-- national ID is in common use), not a Nigerian BVN/NIN only.
--
-- BVN is no longer accepted for new submissions: it is a bank identifier and the
-- owner does not want the platform holding a handle on riders' bank accounts.
-- Old rows keep kyc_type 'bvn'/'nin' as history.
--
-- Where no automated check exists, the rider uploads a photo of the document and
-- an admin reviews it (status 'pending_review'). The photo lives in Cloudinary as
-- an *authenticated* asset (no public URL); kyc_document_id is its public_id and
-- the admin API hands out short-lived signed URLs. Numbers are still stored as
-- the last 4 characters only.

ALTER TABLE rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_kyc_type_check;
ALTER TABLE rider_profiles ADD CONSTRAINT rider_profiles_kyc_type_check
  CHECK (kyc_type IN ('bvn', 'nin', 'national_id', 'passport'));

ALTER TABLE rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_kyc_status_check;
ALTER TABLE rider_profiles ADD CONSTRAINT rider_profiles_kyc_status_check
  CHECK (kyc_status IN ('not_verified', 'pending_review', 'verified', 'failed', 'rejected'));

ALTER TABLE rider_profiles
  ADD COLUMN IF NOT EXISTS kyc_country      CHAR(2),
  ADD COLUMN IF NOT EXISTS kyc_document_id  TEXT,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_by  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at  TIMESTAMPTZ;
