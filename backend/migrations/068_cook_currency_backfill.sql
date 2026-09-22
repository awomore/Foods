-- Every cook was priced in naira, wherever they live.
--
-- cook_profiles.currency_code arrived in 030 with DEFAULT 'NGN' so earnings.js
-- would stop 500ing -- and nothing has written it since. Orders are minted in the
-- cook's currency (routes/orders.js), so a cook in London sold in NGN and every
-- screen that "correctly" used the cook's currency still showed the naira sign.
-- Onboarding now sets it (default: the cook's phone calling code, editable).
--
-- This backfills the cooks already signed up the same way: by the calling code
-- of their phone, longest prefix first (+1876 Jamaica before +1 US). A number
-- in local format ("0802...") carries no country and stays NGN, as does +234.
-- The map is generated from utils/currency.js CALLING_CODES; keep them in step.
--
-- Their catalogue follows them: dishes, courses, products and health plans are
-- relabelled with the cook's currency. Nothing denominated moves -- orders,
-- payouts, escrow and ledger rows keep the currency the money actually moved
-- in, because that is what was charged.
--
-- gift_cards never recorded a currency at all; a card is worth its
-- denomination in the buyer's currency. Existing cards were all bought and
-- charged in NGN, which is the default here.

ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'NGN';

WITH calling_codes (prefix, currency) AS (
  VALUES
    ('+1876', 'JMD'),
    ('+1868', 'TTD'),
    ('+1246', 'BBD'),
    ('+1784', 'XCD'),
    ('+234', 'NGN'),
    ('+254', 'KES'),
    ('+233', 'GHS'),
    ('+255', 'TZS'),
    ('+256', 'UGX'),
    ('+250', 'RWF'),
    ('+251', 'ETB'),
    ('+260', 'ZMW'),
    ('+264', 'NAD'),
    ('+265', 'MWK'),
    ('+267', 'BWP'),
    ('+258', 'MZN'),
    ('+263', 'USD'),
    ('+252', 'USD'),
    ('+231', 'LRD'),
    ('+232', 'SLL'),
    ('+230', 'MUR'),
    ('+248', 'SCR'),
    ('+244', 'AOA'),
    ('+243', 'CDF'),
    ('+221', 'XOF'),
    ('+225', 'XOF'),
    ('+226', 'XOF'),
    ('+227', 'XOF'),
    ('+228', 'XOF'),
    ('+229', 'XOF'),
    ('+220', 'GMD'),
    ('+237', 'XAF'),
    ('+236', 'XAF'),
    ('+235', 'XAF'),
    ('+241', 'XAF'),
    ('+242', 'XAF'),
    ('+240', 'XAF'),
    ('+353', 'EUR'),
    ('+351', 'EUR'),
    ('+358', 'EUR'),
    ('+370', 'EUR'),
    ('+371', 'EUR'),
    ('+372', 'EUR'),
    ('+356', 'EUR'),
    ('+357', 'EUR'),
    ('+386', 'EUR'),
    ('+421', 'EUR'),
    ('+354', 'ISK'),
    ('+420', 'CZK'),
    ('+380', 'UAH'),
    ('+381', 'RSD'),
    ('+359', 'BGN'),
    ('+375', 'BYN'),
    ('+373', 'MDL'),
    ('+374', 'AMD'),
    ('+995', 'GEL'),
    ('+994', 'AZN'),
    ('+506', 'CRC'),
    ('+507', 'PAB'),
    ('+503', 'USD'),
    ('+504', 'HNL'),
    ('+505', 'NIO'),
    ('+502', 'GTQ'),
    ('+501', 'BZD'),
    ('+509', 'HTG'),
    ('+591', 'BOB'),
    ('+592', 'GYD'),
    ('+595', 'PYG'),
    ('+598', 'UYU'),
    ('+597', 'SRD'),
    ('+880', 'BDT'),
    ('+977', 'NPR'),
    ('+852', 'HKD'),
    ('+853', 'MOP'),
    ('+886', 'TWD'),
    ('+855', 'KHR'),
    ('+856', 'LAK'),
    ('+975', 'BTN'),
    ('+960', 'MVR'),
    ('+992', 'TJS'),
    ('+993', 'TMT'),
    ('+996', 'KGS'),
    ('+998', 'UZS'),
    ('+976', 'MNT'),
    ('+971', 'AED'),
    ('+966', 'SAR'),
    ('+974', 'QAR'),
    ('+965', 'KWD'),
    ('+973', 'BHD'),
    ('+968', 'OMR'),
    ('+972', 'ILS'),
    ('+961', 'LBP'),
    ('+962', 'JOD'),
    ('+964', 'IQD'),
    ('+967', 'YER'),
    ('+679', 'FJD'),
    ('+675', 'PGK'),
    ('+27', 'ZAR'),
    ('+20', 'EGP'),
    ('+44', 'GBP'),
    ('+33', 'EUR'),
    ('+49', 'EUR'),
    ('+34', 'EUR'),
    ('+39', 'EUR'),
    ('+31', 'EUR'),
    ('+32', 'EUR'),
    ('+47', 'NOK'),
    ('+46', 'SEK'),
    ('+45', 'DKK'),
    ('+41', 'CHF'),
    ('+48', 'PLN'),
    ('+36', 'HUF'),
    ('+40', 'RON'),
    ('+52', 'MXN'),
    ('+55', 'BRL'),
    ('+54', 'ARS'),
    ('+57', 'COP'),
    ('+56', 'CLP'),
    ('+51', 'PEN'),
    ('+58', 'VES'),
    ('+91', 'INR'),
    ('+92', 'PKR'),
    ('+94', 'LKR'),
    ('+81', 'JPY'),
    ('+82', 'KRW'),
    ('+86', 'CNY'),
    ('+65', 'SGD'),
    ('+60', 'MYR'),
    ('+62', 'IDR'),
    ('+63', 'PHP'),
    ('+66', 'THB'),
    ('+84', 'VND'),
    ('+95', 'MMK'),
    ('+90', 'TRY'),
    ('+61', 'AUD'),
    ('+64', 'NZD'),
    ('+7', 'RUB'),
    ('+1', 'USD')
),
phones AS (
  SELECT cp.id AS cook_id,
         CASE WHEN n.digits LIKE '+%' THEN n.digits ELSE '+' || n.digits END AS e164
  FROM cook_profiles cp
  JOIN users u ON u.id = cp.user_id
  CROSS JOIN LATERAL (SELECT regexp_replace(COALESCE(u.phone, ''), '[^0-9+]', '', 'g') AS digits) n
  WHERE n.digits <> '' AND n.digits NOT LIKE '0%'
),
resolved AS (
  SELECT DISTINCT ON (p.cook_id) p.cook_id, cc.currency
  FROM phones p
  JOIN calling_codes cc ON p.e164 LIKE cc.prefix || '%'
  ORDER BY p.cook_id, length(cc.prefix) DESC
)
UPDATE cook_profiles cp
SET currency_code = r.currency
FROM resolved r
WHERE cp.id = r.cook_id AND cp.currency_code IS DISTINCT FROM r.currency;

UPDATE menu_items mi SET currency_code = cp.currency_code
FROM cook_profiles cp WHERE cp.id = mi.cook_id AND mi.currency_code IS DISTINCT FROM cp.currency_code;

UPDATE courses c SET currency_code = cp.currency_code, currency = cp.currency_code
FROM cook_profiles cp WHERE cp.id = c.cook_id
  AND (c.currency_code IS DISTINCT FROM cp.currency_code OR c.currency IS DISTINCT FROM cp.currency_code);

UPDATE digital_products d SET currency_code = cp.currency_code, currency = cp.currency_code
FROM cook_profiles cp WHERE cp.id = d.cook_id
  AND (d.currency_code IS DISTINCT FROM cp.currency_code OR d.currency IS DISTINCT FROM cp.currency_code);

UPDATE health_meal_plans h SET currency = cp.currency_code
FROM cook_profiles cp WHERE cp.id = h.creator_id AND h.currency IS DISTINCT FROM cp.currency_code;
