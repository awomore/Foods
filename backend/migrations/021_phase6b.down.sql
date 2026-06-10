-- ============================================================
-- DOWN: Revert 021_phase6b.sql
-- ============================================================

DROP INDEX IF EXISTS idx_escrow_auto_release;
DROP INDEX IF EXISTS idx_account_strikes_user;
DROP INDEX IF EXISTS idx_video_views_entity;
DROP INDEX IF EXISTS idx_social_conversions_entity;
DROP INDEX IF EXISTS idx_social_conversions_type;
DROP INDEX IF EXISTS idx_custom_request_messages_request;

DROP TABLE IF EXISTS account_strikes;
DROP TABLE IF EXISTS video_views;
DROP TABLE IF EXISTS social_conversions;
DROP TABLE IF EXISTS custom_request_messages;
DROP TABLE IF EXISTS chef_service_settings;

ALTER TABLE chef_availability
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS max_bookings,
  DROP COLUMN IF EXISTS is_vacation,
  DROP COLUMN IF EXISTS is_blackout;

ALTER TABLE custom_requests
  DROP COLUMN IF EXISTS delivery_date,
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS revision_count,
  DROP COLUMN IF EXISTS quote_versions,
  DROP COLUMN IF EXISTS negotiation_notes,
  DROP COLUMN IF EXISTS escrow_hold_id;

ALTER TABLE menu_items
  DROP COLUMN IF EXISTS video_view_count,
  DROP COLUMN IF EXISTS video_completion_count;

ALTER TABLE cook_diary_posts
  DROP COLUMN IF EXISTS video_view_count,
  DROP COLUMN IF EXISTS video_completion_count;

ALTER TABLE orders
  DROP COLUMN IF EXISTS sla_deadline,
  DROP COLUMN IF EXISTS is_late,
  DROP COLUMN IF EXISTS late_by_minutes,
  DROP COLUMN IF EXISTS fulfillment_score,
  DROP COLUMN IF EXISTS fault_attribution;

ALTER TABLE disputes
  DROP COLUMN IF EXISTS fault_attribution,
  DROP COLUMN IF EXISTS penalty_type,
  DROP COLUMN IF EXISTS penalty_applied_at;

ALTER TABLE course_enrollments
  DROP COLUMN IF EXISTS progress_pct,
  DROP COLUMN IF EXISTS lessons_completed,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS certificate_issued,
  DROP COLUMN IF EXISTS certificate_url,
  DROP COLUMN IF EXISTS certificate_issued_at;

ALTER TABLE escrow_holds
  DROP COLUMN IF EXISTS auto_release_at,
  DROP COLUMN IF EXISTS escrow_type,
  DROP COLUMN IF EXISTS source_id;

ALTER TABLE catering_bookings
  DROP COLUMN IF EXISTS event_tag;
