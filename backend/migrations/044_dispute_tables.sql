-- Migration 044: dispute evidence/messages tables + has_dispute column + evidence_review status

-- Add has_dispute flag to orders (referenced in disputes.js and escrow.js)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS has_dispute BOOLEAN NOT NULL DEFAULT false;

-- Extend disputes.status CHECK constraint to include 'evidence_review'
-- Drop the existing constraint by its auto-generated name, then re-add it.
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'disputes'::regclass AND contype = 'c' AND conname LIKE '%status%';

  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE disputes DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE disputes
  ADD CONSTRAINT disputes_status_check
    CHECK (status IN ('open','investigating','evidence_review','escalated','resolved','closed'));

-- dispute_evidence: files/photos uploaded by either party to support their case
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id   UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL CHECK (role IN ('customer','cook','admin')),
  file_url     TEXT        NOT NULL,
  file_type    TEXT        NOT NULL CHECK (file_type IN ('image','video','document')),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON dispute_evidence (dispute_id);

-- dispute_messages: threaded conversation between customer, cook, and admin moderator
CREATE TABLE IF NOT EXISTS dispute_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('customer','cook','admin')),
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages (dispute_id, created_at ASC);
