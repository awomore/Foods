-- Link orders to meal subscriptions so cooks can see subscription-funded orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS meal_subscription_id UUID REFERENCES meal_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_meal_sub ON orders(meal_subscription_id) WHERE meal_subscription_id IS NOT NULL;
