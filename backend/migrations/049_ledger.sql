-- ============================================================
-- 049 — Phase 3: double-entry ledger foundation
-- ============================================================
-- Introduces an append-only, double-entry ledger. Money movement is recorded
-- as balanced sets of entries (per transaction_id, total debits = total
-- credits); an account's balance is DERIVED by summing its entries, never
-- stored. Amounts are integer minor units (kobo) + ISO-4217 currency, matching
-- the Phase 2 money value type (backend/payments/money.js).
--
-- Additive only — no existing table is touched. Flows (wallet, orders, escrow,
-- payouts) are wired to post here in later slices; this migration just lays the
-- foundation. See backend/payments/ledger.js for the posting/derivation helper.

-- ── ledger_accounts ────────────────────────────────────────────
-- One row per (owner, account_type, currency). owner_id is NULL for singleton
-- platform accounts (e.g. platform revenue, gateway clearing).
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type   TEXT        NOT NULL CHECK (owner_type IN ('user','cook','platform')),
  owner_id     UUID,
  account_type TEXT        NOT NULL,   -- 'wallet','earnings','escrow','revenue','gateway_clearing',...
  currency     CHAR(3)     NOT NULL DEFAULT 'NGN',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Identity uniqueness. owner_id is coalesced to the nil UUID so singleton
-- platform accounts (owner_id IS NULL) can't be created twice — a plain UNIQUE
-- would treat each NULL as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_accounts_identity
  ON ledger_accounts (
    owner_type,
    COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    account_type,
    currency
  );

-- ── ledger_entries ─────────────────────────────────────────────
-- Append-only. Each `transaction_id` groups >= 2 legs whose debits equal their
-- credits (enforced by the application in backend/payments/ledger.js). amount_minor
-- is always positive; `direction` carries the sign.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        NOT NULL,
  account_id     UUID        NOT NULL REFERENCES ledger_accounts(id),
  direction      TEXT        NOT NULL CHECK (direction IN ('debit','credit')),
  amount_minor   BIGINT      NOT NULL CHECK (amount_minor > 0),
  currency       CHAR(3)     NOT NULL DEFAULT 'NGN',
  entry_type     TEXT,       -- 'wallet_topup','order_capture','payout','refund',...
  description    TEXT,
  ref            TEXT,       -- business/external reference for tracing + idempotency
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_txn     ON ledger_entries (transaction_id);
-- Guards against posting the same business event twice (partial: only when a
-- ref is supplied). One ref per account+direction.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_entries_ref
  ON ledger_entries (ref, account_id, direction) WHERE ref IS NOT NULL;
