-- Migration 028: Daily marketplace health snapshots
-- Stores computed KPIs so the admin dashboard can track recommendation
-- quality over time without querying live transactional tables.

CREATE TABLE IF NOT EXISTS marketplace_health_snapshots (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date                    date DEFAULT CURRENT_DATE,
  -- Supply health
  new_creator_activation_rate_30d  numeric,   -- target >40%
  creator_60d_retention_rate       numeric,
  top10_gmv_concentration          numeric,   -- alarm if >60% (monopoly risk)
  -- Demand health
  new_user_first_order_rate_7d     numeric,   -- target >30%
  day30_retention_rate             numeric,
  -- Recommendation quality
  feed_ctr_for_you                 numeric,
  feed_ctr_trending                numeric,
  cold_start_avg_sessions_to_order numeric,
  -- Automated intervention flags (e.g. 'debut_boost_triggered', 'top10_alarm')
  interventions_triggered          text[] DEFAULT '{}',
  created_at                       timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mhs_date_unique
  ON marketplace_health_snapshots(snapshot_date);
