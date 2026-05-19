-- ============================================================
-- FOODSbyme Migration 010: Stored procedures
-- These are CRITICAL — they prevent overselling under concurrent requests.
-- ============================================================

-- Atomic pre-order slot claim
-- Returns true if slot was claimed, false if sold out.
-- Uses row-level locking to prevent race conditions.
CREATE OR REPLACE FUNCTION claim_slot(p_menu_item_id uuid)
RETURNS boolean AS $$
DECLARE
  v_total integer;
  v_claimed integer;
BEGIN
  -- Lock the row for update
  SELECT total_slots, slots_claimed
  INTO v_total, v_claimed
  FROM menu_items
  WHERE id = p_menu_item_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_claimed >= v_total THEN
    RETURN false;
  END IF;

  UPDATE menu_items
  SET slots_claimed = slots_claimed + 1,
      updated_at = now()
  WHERE id = p_menu_item_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;


-- Atomic real-time slot claim
CREATE OR REPLACE FUNCTION claim_realtime_slot(p_menu_item_id uuid)
RETURNS boolean AS $$
DECLARE
  v_total integer;
  v_claimed integer;
  v_available boolean;
BEGIN
  SELECT realtime_slots, realtime_slots_claimed, realtime_available
  INTO v_total, v_claimed, v_available
  FROM menu_items
  WHERE id = p_menu_item_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND OR NOT v_available THEN
    RETURN false;
  END IF;

  IF v_claimed >= v_total THEN
    RETURN false;
  END IF;

  UPDATE menu_items
  SET realtime_slots_claimed = realtime_slots_claimed + 1,
      updated_at = now()
  WHERE id = p_menu_item_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;


-- Compute repeat order rate for a cook
-- Used nightly by cron job to update cook_profiles.repeat_order_rate
CREATE OR REPLACE FUNCTION compute_repeat_rate(p_cook_id uuid)
RETURNS TABLE (rate decimal) AS $$
  SELECT CASE WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      COUNT(*) FILTER (
        WHERE customer_id IN (
          SELECT customer_id FROM orders
          WHERE cook_id = p_cook_id AND status = 'delivered'
          GROUP BY customer_id HAVING COUNT(*) > 1
        )
      )::decimal / COUNT(*)::decimal * 100, 1
    )
  END as rate
  FROM orders
  WHERE cook_id = p_cook_id AND status = 'delivered';
$$ LANGUAGE sql;


-- Trigger: update cook follower count when follows table changes
CREATE OR REPLACE FUNCTION update_cook_follower_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cook_profiles
    SET platform_follower_count = platform_follower_count + 1
    WHERE id = NEW.cook_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cook_profiles
    SET platform_follower_count = GREATEST(platform_follower_count - 1, 0)
    WHERE id = OLD.cook_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follows_count
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_cook_follower_count();


-- Trigger: update cook chop talk post count
CREATE OR REPLACE FUNCTION update_chop_talk_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cook_profiles
    SET chop_talk_post_count = chop_talk_post_count + 1
    WHERE id = NEW.cook_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chop_talk_count
AFTER INSERT ON chop_talk_posts
FOR EACH ROW EXECUTE FUNCTION update_chop_talk_count();
