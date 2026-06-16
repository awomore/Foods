-- Migration 038: Catering marketplace — open briefs + bidding

-- Bids table: cooks compete on open catering briefs
CREATE TABLE IF NOT EXISTS catering_bids (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID NOT NULL REFERENCES catering_events(id) ON DELETE CASCADE,
  cook_id                UUID NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  quoted_price           NUMERIC(12,2) NOT NULL,
  notes                  TEXT,
  availability_confirmed BOOLEAN DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, cook_id)
);

CREATE INDEX IF NOT EXISTS idx_catering_bids_event  ON catering_bids(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_bids_cook   ON catering_bids(cook_id);

-- Allow cook_id to be NULL on catering_events (open marketplace briefs)
ALTER TABLE catering_events ALTER COLUMN cook_id DROP NOT NULL;
