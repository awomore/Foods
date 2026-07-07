-- Reverse 054 — drop the order_count_90d column from menu_items.
ALTER TABLE menu_items DROP COLUMN IF EXISTS order_count_90d;
