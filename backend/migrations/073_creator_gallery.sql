-- Creator Gallery: photos of past work on a creator's public profile.
--
-- A photo is either loose or in an album ("these are from one event"). Instead
-- of a date it carries a price: a link to a menu dish (live price, opens the
-- dish) or a typed guide price in the creator's currency ("from ₦85,000").
-- Photos of the creator's active dishes are added to the public gallery at read
-- time and are not stored here.
--
-- Albums and photos can be reported; admin hides the reported item.

CREATE TABLE IF NOT EXISTS gallery_albums (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id     UUID        NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_hidden   BOOLEAN     NOT NULL DEFAULT false,
  hidden_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gallery_albums_cook ON gallery_albums (cook_id, sort_order);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cook_id       UUID          NOT NULL REFERENCES cook_profiles(id) ON DELETE CASCADE,
  -- Deleting an album keeps its photos as loose gallery photos.
  album_id      UUID          REFERENCES gallery_albums(id) ON DELETE SET NULL,
  url           TEXT          NOT NULL,
  public_id     TEXT,
  -- A linked dish shows its live price and opens the dish; it wins over guide_price.
  menu_item_id  UUID          REFERENCES menu_items(id) ON DELETE SET NULL,
  guide_price   NUMERIC(14,2) CHECK (guide_price IS NULL OR guide_price > 0),
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  is_hidden     BOOLEAN       NOT NULL DEFAULT false,
  hidden_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_cook  ON gallery_photos (cook_id, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_album ON gallery_photos (album_id);

CREATE TABLE IF NOT EXISTS gallery_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  album_id     UUID        REFERENCES gallery_albums(id) ON DELETE CASCADE,
  photo_id     UUID        REFERENCES gallery_photos(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT        CHECK (resolution IS NULL OR resolution IN ('hidden', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((album_id IS NULL) <> (photo_id IS NULL))
);
-- One open report per person per item.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gallery_reports_open
  ON gallery_reports (reporter_id, COALESCE(album_id, photo_id)) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gallery_reports_open ON gallery_reports (created_at DESC) WHERE resolved_at IS NULL;
