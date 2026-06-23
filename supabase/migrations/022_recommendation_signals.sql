-- Migration 022: Per-user behavioral interaction signals with decay windows
-- Used by the recommendation engine to understand user behavior without
-- relying on all-time counts that large actors can game via volume alone.

CREATE TABLE IF NOT EXISTS user_interaction_signals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL,    -- 'cook'|'dish'|'story'|'post'|'course'
  entity_id    uuid NOT NULL,
  signal_type  text NOT NULL,    -- 'order'|'repeat_order'|'profile_view'|'story_complete'|'skip'|'craving'|'follow'|'search'
  signal_strength numeric NOT NULL DEFAULT 1.0,
  created_at   timestamptz DEFAULT now(),
  expires_at   timestamptz NOT NULL   -- computed per signal_type by application layer
);

CREATE INDEX IF NOT EXISTS uis_user_entity_created
  ON user_interaction_signals(user_id, entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS uis_expires_cleanup
  ON user_interaction_signals(expires_at)
  WHERE expires_at IS NOT NULL;
