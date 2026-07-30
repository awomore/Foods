-- 062: the two search_trending counters the trending job has always required
--
-- Found by running the real trending job against production: it still failed
-- after 060 gave trending_entities a schema, on `column "term" does not exist`.
--
-- The table (020_phase6.sql) is `query` / `count` / `last_seen` and has live
-- rows. services/trending.js:120-127 instead reads `term`, `search_count`,
-- `unique_user_count`, `order_conversion_count` and `created_at` — five names,
-- three of them simply wrong and two never created. Its comment claims
-- unique_user_count was "added in migration 026"; no migration has ever added
-- it, the same phantom-migration claim that hid the analytics gap.
--
-- The renames are fixed in the code, not here, because `query` is the primary
-- key, the stored function upsert_trending_search() writes it, and the mobile
-- client's SearchTrending type is `{ query, count }` — the established schema is
-- right on all three counts and the service invented the other names. Only the
-- two genuinely new counters belong in a migration.
--
-- This also unbreaks GET /api/search/trending, which selects the same wrong
-- names and has been 500ing; app/search.tsx swallows that with .catch(() => {}),
-- so the trending row has silently been empty rather than visibly broken.
--
-- NOT NULL DEFAULT 0 so the weighted ORDER BY never has to COALESCE a NULL into
-- a score, and so a term that has never converted sorts as zero rather than
-- vanishing from the ranking.

ALTER TABLE search_trending
  ADD COLUMN IF NOT EXISTS unique_user_count      integer NOT NULL DEFAULT 0;
ALTER TABLE search_trending
  ADD COLUMN IF NOT EXISTS order_conversion_count integer NOT NULL DEFAULT 0;

-- computeSearchTrending and GET /api/search/trending both window on last_seen.
CREATE INDEX IF NOT EXISTS idx_search_trending_last_seen
  ON search_trending USING btree (last_seen DESC);
