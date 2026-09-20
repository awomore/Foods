-- YouTube was the one platform a creator could impersonate.
--
-- claimUnverified() in routes/socialVerify.js is the anti-impersonation guard:
-- the first time a platform is OAuth-verified, the real handle must match the
-- handle claimed at onboarding, or that claim was never the creator's to make.
-- The guard compares the OAuth handle against the platform's *_handle column --
-- and YouTube had none, so the callback never called it. Instagram, TikTok and X
-- were all guarded; YouTube alone was not.
--
-- youtube_url already exists (001_base_schema) and is a different thing: a
-- self-typed link to a channel, entered at onboarding and verified by nothing.
-- Reusing it as the guard's input would have compared one unverified string
-- against another and called the result proof.
--
-- Nullable with no backfill. NULL is what claimUnverified reads as "claimed
-- nothing", which lets a first connection through instead of locking it out --
-- the correct reading for every existing row, none of which has ever had a
-- YouTube handle confirmed by Google.

ALTER TABLE cook_profiles ADD COLUMN IF NOT EXISTS youtube_handle TEXT;
