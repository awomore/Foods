-- Before 068 nothing wrote a cook's currency, so every cook and their catalogue
-- was NGN. Rolling back restores that -- including for cooks who picked a
-- currency at onboarding after 068 shipped, whose choice this discards.

UPDATE cook_profiles     SET currency_code = 'NGN' WHERE currency_code <> 'NGN';
UPDATE menu_items        SET currency_code = 'NGN' WHERE currency_code <> 'NGN';
UPDATE courses           SET currency_code = 'NGN', currency = 'NGN' WHERE currency_code <> 'NGN' OR currency <> 'NGN';
UPDATE digital_products  SET currency_code = 'NGN', currency = 'NGN' WHERE currency_code <> 'NGN' OR currency <> 'NGN';
UPDATE health_meal_plans SET currency = 'NGN' WHERE currency <> 'NGN';

ALTER TABLE gift_cards DROP COLUMN IF EXISTS currency;
