-- Down for 057. Dependency order reversed: children before parents.
-- Destructive — these tables hold real invoices, quotations and gift-card
-- balances once live. Only run against a database you are willing to lose.

DROP TABLE IF EXISTS cook_verification_log;
DROP TABLE IF EXISTS bulk_requests;
DROP TABLE IF EXISTS affiliate_links;
DROP TABLE IF EXISTS digital_product_purchases;
DROP TABLE IF EXISTS health_subscriptions;
DROP TABLE IF EXISTS group_gift_contributions;
DROP TABLE IF EXISTS group_gifts;
DROP TABLE IF EXISTS gift_cards;
DROP TABLE IF EXISTS creator_subscriptions;
DROP TABLE IF EXISTS creator_subscription_tiers;
DROP TABLE IF EXISTS quotations;
DROP TABLE IF EXISTS invoices;
