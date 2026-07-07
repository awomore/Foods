-- ============================================================
-- 054 — menu_items.order_count_90d (schema-drift fix)
-- ============================================================
-- routes/discover.js ranks dish search results by a composite of creator score
-- and 90-day order velocity (LEAST(COALESCE(mi.order_count_90d,0)/50, 1) * 0.4),
-- and services/ranking.js reads `dish.order_count_90d ?? 0`. The column was
-- never created, so GET /discover 500'd with
-- `column mi.order_count_90d does not exist` (surfaced only after 053 fixed the
-- creator_score_dimensions join it also uses).
--
-- It is read-only with a 0 fallback (no writer yet — a future ranking-recompute
-- job can populate it), so adding it DEFAULT 0 restores /discover with zero
-- behaviour change. Additive + idempotent — safe and reversible.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS order_count_90d INTEGER NOT NULL DEFAULT 0;
