-- ── users.country_code ───────────────────────────────────────────────────────
-- GET /cooks, GET /cooks/:id and discover queries select u.country_code
-- (present since the initial commit) but the column never existed in the
-- production schema, 500ing the entire cook discovery surface.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'NG';
