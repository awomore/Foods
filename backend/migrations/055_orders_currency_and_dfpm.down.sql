-- Reverse 055 — drop the two columns from orders.
ALTER TABLE orders
  DROP COLUMN IF EXISTS currency_code,
  DROP COLUMN IF EXISTS delivery_fee_payment_method;
