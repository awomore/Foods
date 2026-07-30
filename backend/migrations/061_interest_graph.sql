-- 061: the interest graph — the last cluster with no schema anywhere
--
-- services/interestGraph.js and services/signals.js are the only writers, and
-- routes/feed.js, routes/followSuggestions.js and services/ranking.js are the
-- readers. Every column below is determined by those files:
--
--   customer_interest_graphs   interestGraph.js:14-35, 45-50, 63-69
--   user_cuisine_preferences   interestGraph.js:20-22, 141-146
--   user_interaction_signals   signals.js:43-48, 86-93
--
-- Live impact: feed.js swallows the failure (`try { … } catch {}`) and silently
-- ranks with no cuisine signal at all, while /api/follow-suggestions 500s
-- outright — it both reads the graph and selects a column that does not exist.
--
-- Guarded throughout, so replaying is a no-op.

-- ── customer_interest_graphs ─────────────────────────────────────────────────
-- One row per user. cuisine_affinities is an object of cuisine → 0..1, blended
-- by an exponential moving average (alpha 0.15) on every signal and rounded to
-- three decimals by the service.
--
-- price_band_min/max are deliberately NULL by default, and MUST STAY THAT WAY.
-- updateFromOrder widens the band with LEAST(price_band_min, price*0.7) and
-- GREATEST(price_band_max, price*1.5). PostgreSQL's LEAST/GREATEST ignore NULL
-- inputs and return NULL only when every input is NULL, so a NULL start means
-- the first order defines the band. Seeding a non-null default would be the
-- actual bug: LEAST(0, anything) pins the minimum at 0 forever, and the band
-- could never narrow onto what the customer really buys. getPriceBand already
-- reads NULL as "no band yet" and substitutes 0/999999.
CREATE TABLE IF NOT EXISTS customer_interest_graphs (
  id                  uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id             uuid NOT NULL,
  cuisine_affinities  jsonb DEFAULT '{}'::jsonb NOT NULL,
  price_band_min      numeric(12,2),
  price_band_max      numeric(12,2),
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT customer_interest_graphs_pkey PRIMARY KEY (id),
  -- getOrCreateGraph and saveOnboardingPreferences both ON CONFLICT (user_id).
  CONSTRAINT customer_interest_graphs_user_id_key UNIQUE (user_id),
  CONSTRAINT customer_interest_graphs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── user_cuisine_preferences ─────────────────────────────────────────────────
-- Explicit choices from the onboarding preference screen, kept separately from
-- the inferred affinities so a re-bootstrap can tell them apart.
CREATE TABLE IF NOT EXISTS user_cuisine_preferences (
  id          uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id     uuid NOT NULL,
  cuisine     text NOT NULL,
  source      text DEFAULT 'onboarding'::text NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_cuisine_preferences_pkey PRIMARY KEY (id),
  -- saveOnboardingPreferences relies on ON CONFLICT (user_id, cuisine).
  CONSTRAINT user_cuisine_preferences_user_id_cuisine_key UNIQUE (user_id, cuisine),
  CONSTRAINT user_cuisine_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── user_interaction_signals ─────────────────────────────────────────────────
-- Raw behavioural signal log, each row expiring on its own decay window (7–90
-- days, per signals.js DECAY_WINDOWS).
--
-- No CHECK on entity_type or signal_type, deliberately. entity_id is polymorphic
-- (menu_items.id for orders, cook_profiles.id for profile/story/skip, NULL for
-- search) so it carries no FK, and for a search signal entity_type holds the raw
-- query string rather than a type name — see signals.js:76. The two vocabularies
-- in the codebase already disagree anyway: routes/signals.js accepts
-- 'craving_submit' while the service's tables key on 'craving'.
--
-- signal_strength is signed: skips are negative (-0.1, -0.05).
CREATE TABLE IF NOT EXISTS user_interaction_signals (
  id               uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id          uuid NOT NULL,
  entity_type      text NOT NULL,
  entity_id        uuid,
  signal_type      text NOT NULL,
  signal_strength  numeric(4,3) DEFAULT 1.0 NOT NULL,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_interaction_signals_pkey PRIMARY KEY (id),
  CONSTRAINT user_interaction_signals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- cleanupExpiredSignals: DELETE ... WHERE expires_at < NOW(), daily.
CREATE INDEX IF NOT EXISTS idx_user_interaction_signals_expires
  ON user_interaction_signals USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_interaction_signals_user
  ON user_interaction_signals USING btree (user_id, created_at DESC);

-- ── cook_profiles.cuisine_types ──────────────────────────────────────────────
-- Not a new idea — four modules already read it as a text[] and it has never
-- existed in any database: interestGraph.js (3 sites), services/ranking.js
-- (scoreFeed's cuisine_match and applyAntiMonopoly's per-cuisine cap), and
-- routes/followSuggestions.js, which both SELECTs it and filters on
-- `cp.cuisine_types && $1::text[]`. That last one is why follow-suggestions
-- returns a 500 rather than degrading.
--
-- NOT NULL with an empty default because the array-overlap operator returns
-- NULL against a NULL left operand, which would silently drop every candidate
-- instead of matching none.
--
-- WHOEVER POPULATES THIS COLUMN MUST LOWER-CASE IT. Affinity keys are
-- lower-cased everywhere in interestGraph.js, and followSuggestions.js feeds
-- those keys straight into `cp.cuisine_types && $1::text[]`, which is
-- case-sensitive. Storing 'Thai' means the overlap never fires and cuisine
-- matching silently degrades to zero — no error, just worse suggestions.
ALTER TABLE cook_profiles
  ADD COLUMN IF NOT EXISTS cuisine_types text[] DEFAULT '{}'::text[] NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cook_profiles_cuisine_types
  ON cook_profiles USING gin (cuisine_types);
