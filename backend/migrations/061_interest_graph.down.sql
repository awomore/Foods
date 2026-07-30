-- Down for 061.
--
-- Destructive: the interest graph is inferred from months of behaviour and
-- cannot be rebuilt from anything else — the raw signals expire on 7–90 day
-- windows, so dropping these loses personalisation permanently.
--
-- cook_profiles.cuisine_types is left in place on purpose: four modules read it
-- and dropping it would reintroduce the follow-suggestions 500.

DROP TABLE IF EXISTS user_interaction_signals;
DROP TABLE IF EXISTS user_cuisine_preferences;
DROP TABLE IF EXISTS customer_interest_graphs;
