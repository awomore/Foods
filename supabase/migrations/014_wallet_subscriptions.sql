-- Wallet: per-customer NGN balance + transaction ledger
CREATE TABLE IF NOT EXISTS wallet_balances (
  customer_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_ngn   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance_ngn >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('topup','credit','debit','refund','gift_redeem')),
  amount_ngn    NUMERIC(12,2) NOT NULL,
  description   TEXT,
  order_id      UUID REFERENCES orders(id) ON DELETE SET NULL,
  ref           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_customer ON wallet_transactions(customer_id, created_at DESC);

-- Meal subscriptions (gifted recurring meal plans)
CREATE TABLE IF NOT EXISTS meal_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gifter_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id           TEXT NOT NULL,
  sub_type          TEXT NOT NULL,
  meal_slots        TEXT[] NOT NULL DEFAULT '{}',
  add_dietician     BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_name    TEXT NOT NULL,
  recipient_phone   TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  preferences       TEXT,
  total_amount      NUMERIC(12,2),
  currency_code     TEXT NOT NULL DEFAULT 'NGN',
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_delivery     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meal_subs_gifter ON meal_subscriptions(gifter_id);

-- Individual meal deliveries within a subscription
CREATE TABLE IF NOT EXISTS subscription_meals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES meal_subscriptions(id) ON DELETE CASCADE,
  delivery_date     DATE NOT NULL,
  meal_slot         TEXT NOT NULL,
  meal_title        TEXT,
  meal_description  TEXT,
  cook_note         TEXT,
  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','delivered','approved','rejected','skipped')),
  gifter_feedback   TEXT,
  recipient_feedback TEXT,
  approved_by       TEXT CHECK (approved_by IN ('gifter','recipient')),
  rejected_by       TEXT CHECK (rejected_by IN ('gifter','recipient')),
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_meals_sub ON subscription_meals(subscription_id, delivery_date);
