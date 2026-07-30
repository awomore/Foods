-- Down for 062. Destructive: these counters accumulate from live search traffic
-- and cannot be recomputed from anything else.

DROP INDEX IF EXISTS idx_search_trending_last_seen;
ALTER TABLE search_trending DROP COLUMN IF EXISTS order_conversion_count;
ALTER TABLE search_trending DROP COLUMN IF EXISTS unique_user_count;
