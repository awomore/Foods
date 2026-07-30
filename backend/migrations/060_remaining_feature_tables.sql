-- 060: the five single-table features that never had schema anywhere
--
-- Unlike 057 (tables reconstructed from the live development catalog), none of
-- these five have ever existed in ANY database — they were written straight into
-- the query layer and no migration was ever produced. So the DDL below is
-- derived from the queries that read and write them, not copied from a catalog.
-- Each column is justified by a call site; nothing here is speculative:
--
--   trending_entities   services/trending.js (writer, cron every 2h),
--                       routes/feed.js:102, routes/followSuggestions.js:99,118
--   user_connections    routes/connections.js (all four endpoints)
--   story_completions   routes/stories.js:49,59,150, services/creatorScore.js:158
--   subscription_meals  routes/gifting.js:305,331,338
--   rider_locations     routes/fleet.js:644,701,890
--
-- Live impact this fixes: the trending cron has been throwing every two hours
-- ("[trending] computation failed"), /api/connections 500s on every call, story
-- completion never records so creator_score's story dimension is always 0, and
-- the fleet location endpoints silently return nothing.
--
-- Guarded throughout (IF NOT EXISTS, constraints inline in CREATE TABLE, never a
-- bare ADD CONSTRAINT) so replaying this migration is a no-op — the rule
-- migrations 024/044/046 broke.

-- ── trending_entities ────────────────────────────────────────────────────────
-- Materialised output of the trending computation. Rewritten wholesale per
-- entity_type (DELETE then INSERT) every 2 hours by services/trending.js.
--
-- entity_id is polymorphic — menu_items.id for 'dish', cook_profiles.id for
-- 'creator', and NULL for 'search' (a search term has only a label) — so it
-- carries no foreign key. The partial unique index enforces the one-row-per-
-- entity invariant that followSuggestions.js relies on: it LEFT JOINs on
-- entity_id, so a duplicate would silently multiply suggestion rows.
CREATE TABLE IF NOT EXISTS trending_entities (
  id                     uuid DEFAULT gen_random_uuid() NOT NULL,
  entity_type            text NOT NULL,
  entity_id              uuid,
  entity_label           text,
  order_velocity         numeric(6,5),
  new_customer_velocity  numeric(6,5),
  trending_score         numeric(6,5) DEFAULT 0 NOT NULL,
  computed_at            timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT trending_entities_pkey PRIMARY KEY (id),
  CONSTRAINT trending_entities_entity_type_check
    CHECK (entity_type = ANY (ARRAY['dish'::text, 'creator'::text, 'search'::text]))
);
-- feed.js: WHERE entity_type = 'creator' ORDER BY trending_score DESC LIMIT 20
CREATE INDEX IF NOT EXISTS idx_trending_entities_type_score
  ON trending_entities USING btree (entity_type, trending_score DESC);
-- followSuggestions.js: LEFT JOIN ... ON te.entity_id = cp.id
CREATE INDEX IF NOT EXISTS idx_trending_entities_entity
  ON trending_entities USING btree (entity_id);
-- trending.js: DELETE ... WHERE computed_at < NOW() - INTERVAL '25 hours'
CREATE INDEX IF NOT EXISTS idx_trending_entities_computed
  ON trending_entities USING btree (computed_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trending_entities_type_entity
  ON trending_entities USING btree (entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- ── user_connections ─────────────────────────────────────────────────────────
-- Customer-to-customer connections, optionally created off the back of a shared
-- order. connections.js checks for an existing row in EITHER direction before
-- inserting, so the unique pair key is directional by design: it stops a double
-- request, while the application stops the reciprocal one.
CREATE TABLE IF NOT EXISTS user_connections (
  id               uuid DEFAULT gen_random_uuid() NOT NULL,
  requester_id     uuid NOT NULL,
  recipient_id     uuid NOT NULL,
  status           text DEFAULT 'pending'::text NOT NULL,
  shared_order_id  uuid,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_connections_pkey PRIMARY KEY (id),
  CONSTRAINT user_connections_pair_key UNIQUE (requester_id, recipient_id),
  CONSTRAINT user_connections_requester_id_fkey
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_connections_recipient_id_fkey
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_connections_shared_order_id_fkey
    FOREIGN KEY (shared_order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT user_connections_not_self CHECK (requester_id <> recipient_id),
  CONSTRAINT user_connections_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'blocked'::text]))
);
-- Both list and status lookups filter on either side of the pair.
CREATE INDEX IF NOT EXISTS idx_user_connections_requester
  ON user_connections USING btree (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_user_connections_recipient
  ON user_connections USING btree (recipient_id, status);

-- ── story_completions ────────────────────────────────────────────────────────
-- Viewer watched a story to the end. Deliberately shaped exactly like
-- story_views (016_stories.sql) — the two are always read as a pair to compute
-- story_completion_rate, and the composite PK is what stories.js:152 conflicts
-- on (ON CONFLICT (story_id, viewer_id) DO NOTHING).
CREATE TABLE IF NOT EXISTS story_completions (
  story_id      uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id     uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_story_completions_viewer
  ON story_completions USING btree (viewer_id);

-- ── subscription_meals ───────────────────────────────────────────────────────
-- The per-delivery schedule under a gifted meal_subscriptions row. Columns and
-- the status/approver vocabularies come from the SubscriptionMeal interface in
-- mobile/src/api/gifting.ts, which is what the UI already renders.
--
-- NOTE: nothing writes rows to this table yet. gifting.js only SELECTs the
-- schedule and UPDATEs feedback on rows it assumes exist; the generator that
-- would create a meal per delivery date has never been written. Creating the
-- table makes GET .../meals return [] instead of 500, but the schedule stays
-- empty until that generator exists.
CREATE TABLE IF NOT EXISTS subscription_meals (
  id                  uuid DEFAULT gen_random_uuid() NOT NULL,
  subscription_id     uuid NOT NULL,
  delivery_date       date NOT NULL,
  meal_slot           text NOT NULL,
  meal_title          text,
  meal_description    text,
  cook_note           text,
  status              text DEFAULT 'scheduled'::text NOT NULL,
  gifter_feedback     text,
  recipient_feedback  text,
  approved_by         text,
  rejected_by         text,
  rejection_reason    text,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT subscription_meals_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_meals_slot_key UNIQUE (subscription_id, delivery_date, meal_slot),
  CONSTRAINT subscription_meals_subscription_id_fkey
    FOREIGN KEY (subscription_id) REFERENCES meal_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT subscription_meals_status_check
    CHECK (status = ANY (ARRAY['scheduled'::text, 'delivered'::text, 'approved'::text,
                               'rejected'::text, 'skipped'::text])),
  CONSTRAINT subscription_meals_approved_by_check
    CHECK (approved_by IS NULL OR approved_by = ANY (ARRAY['gifter'::text, 'recipient'::text])),
  CONSTRAINT subscription_meals_rejected_by_check
    CHECK (rejected_by IS NULL OR rejected_by = ANY (ARRAY['gifter'::text, 'recipient'::text]))
);
-- gifting.js: WHERE subscription_id = $1 ORDER BY delivery_date ASC, meal_slot ASC
CREATE INDEX IF NOT EXISTS idx_subscription_meals_schedule
  ON subscription_meals USING btree (subscription_id, delivery_date, meal_slot);

-- ── meal_subscriptions: unblock the parent of subscription_meals ─────────────
-- Found while testing the table above. meal_subscriptions was defined in 001
-- for a customer↔cook plan (customer_id and cook_id NOT NULL), but the feature
-- that actually shipped is a *gift*: routes/gifting.js:233-243 inserts
-- gifter_id + recipient_name/phone/address and never supplies either NOT NULL
-- column. Nothing else in the backend inserts into this table at all.
--
-- So POST /api/gifting/subscriptions has been failing in production on a
-- not-null violation, which is also why subscription_meals could never have a
-- parent row there. The development database dropped both columns by hand, so
-- the endpoint works locally — the same shape of divergence 057/058 fixed.
--
-- Nulling the requirement rather than dropping the columns: they are harmless
-- when unused, and orders.meal_subscription_id may yet want a cook-linked plan.
-- Wrapped in a guard because the columns do not exist in the development
-- database, where a bare ALTER would fail.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'meal_subscriptions'
               AND column_name = 'customer_id') THEN
    ALTER TABLE meal_subscriptions ALTER COLUMN customer_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'meal_subscriptions'
               AND column_name = 'cook_id') THEN
    ALTER TABLE meal_subscriptions ALTER COLUMN cook_id DROP NOT NULL;
  END IF;
END $$;

-- ── rider_locations ──────────────────────────────────────────────────────────
-- Last known GPS position per active order — one row per order, upserted by the
-- rider app. Column list is taken verbatim from the self-healing CREATE TABLE
-- that routes/fleet.js carried inline (removed in the same commit as this
-- migration), with two additions: a foreign key on rider_user_id, which the
-- admin map already joins to rider_profiles.user_id, and an index on updated_at
-- for the "moving in the last 10 minutes" query.
CREATE TABLE IF NOT EXISTS rider_locations (
  order_id       uuid NOT NULL,
  rider_user_id  uuid,
  latitude       numeric(10,7) NOT NULL,
  longitude      numeric(10,7) NOT NULL,
  heading        numeric(5,2),
  speed          numeric(6,2),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rider_locations_pkey PRIMARY KEY (order_id),
  CONSTRAINT rider_locations_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT rider_locations_rider_user_id_fkey
    FOREIGN KEY (rider_user_id) REFERENCES users(id) ON DELETE SET NULL
);
-- fleet.js: WHERE rl.updated_at >= NOW() - INTERVAL '10 minutes'
CREATE INDEX IF NOT EXISTS idx_rider_locations_updated
  ON rider_locations USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_locations_rider
  ON rider_locations USING btree (rider_user_id);
