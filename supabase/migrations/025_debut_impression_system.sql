-- Migration 025: New creator debut impression budget system
-- Ensures new creators get guaranteed discovery slots before their
-- creator_score has had time to accumulate, solving the cold-start
-- problem without manual curation.

CREATE TABLE IF NOT EXISTS creator_debut_impressions (
  cook_id                uuid PRIMARY KEY REFERENCES cook_profiles(id) ON DELETE CASCADE,
  phase                  integer DEFAULT 1,    -- 1=Debut, 2=Growth, 3=Established
  impressions_budget_week  integer DEFAULT 500,
  impressions_served_week  integer DEFAULT 0,
  week_start             date DEFAULT CURRENT_DATE,
  phase_start_date       date DEFAULT CURRENT_DATE,
  phase1_order_count     integer DEFAULT 0,   -- must hit ≥1 to advance to phase 2
  phase2_order_count     integer DEFAULT 0,   -- must hit ≥10 to graduate to phase 3
  label                  text DEFAULT 'New on FOODS',
  updated_at             timestamptz DEFAULT now()
);
