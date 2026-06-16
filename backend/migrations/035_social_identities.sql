-- Social login identities table
CREATE TABLE IF NOT EXISTS social_identities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_id TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_social_identities_user ON social_identities(user_id);

-- Allow email on users to be nullable (social users may not have phone)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
