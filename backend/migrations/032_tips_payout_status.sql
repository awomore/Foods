-- Track payout state for tips so they are included in cook payout batches
ALTER TABLE tips ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE tips ADD COLUMN IF NOT EXISTS payout_batch_id TEXT;
CREATE INDEX IF NOT EXISTS tips_payout_cook_idx ON tips(cook_id, payout_status);
