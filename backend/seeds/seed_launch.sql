-- ============================================================
-- FOODSbyme Launch Seed Data
-- Apply to production Neon AFTER all migrations are applied.
-- Run: psql $DATABASE_URL -f backend/seeds/seed_launch.sql
-- Idempotent: safe to run multiple times (uses ON CONFLICT DO NOTHING).
-- ============================================================

BEGIN;

-- ── User accounts for seed cooks ────────────────────────────
INSERT INTO users (id, phone, full_name, role, tos_accepted_at, tos_version, privacy_accepted_at)
VALUES
  ('11111111-0000-0000-0000-000000000001', '2348011111001', 'Adaeze Okonkwo',  'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000002', '2348011111002', 'Emeka Nwachukwu', 'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000003', '2348011111003', 'Fatima Al-Hassan','cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000004', '2348011111004', 'Tunde Bakare',    'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000005', '2348011111005', 'Ngozi Eze',       'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000006', '2348011111006', 'Amaka Obi',       'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000007', '2348011111007', 'Chidi Okafor',    'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000008', '2348011111008', 'Halima Musa',     'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000009', '2348011111009', 'Bola Adeyemi',    'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000010', '2348011111010', 'Chisom Nwosu',    'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000011', '2348011111011', 'Rukayat Sule',    'cook', NOW(), '1.0', NOW()),
  ('11111111-0000-0000-0000-000000000012', '2348011111012', 'Ifeanyi Chukwu',  'cook', NOW(), '1.0', NOW())
ON CONFLICT (phone) DO NOTHING;

-- ── Cook profiles ────────────────────────────────────────────
INSERT INTO cook_profiles (
  id, user_id, display_name, username, bio,
  location, latitude, longitude,
  avatar_url, kitchen_photos,
  average_rating, total_reviews, trust_score,
  is_active, food_safety_verified, identity_verified,
  creator_types, currency_code,
  accepts_private_chef, accepts_catering,
  platform_follower_count
) VALUES
  (
    'cccccccc-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'Ada Kitchen', 'adakitchen',
    'Authentic Igbo meals made with love. Ofe Onugbu, Egusi, Banga soup — real Lagos home cooking.',
    'Lekki Phase 1, Lagos', 6.4281, 3.4219,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/ada_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/ada_kitchen.jpg'],
    4.8, 127, 94,
    true, true, true,
    ARRAY['home_cook'], 'NGN',
    false, false, 1240
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000002',
    'Emeka Smoky Grill', 'emekagrill',
    'Lagos street food elevated. Suya, pepper soup, and grilled catfish. Abuja-trained pitmaster.',
    'Victoria Island, Lagos', 6.4281, 3.4134,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/emeka_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/emeka_kitchen.jpg'],
    4.7, 89, 91,
    true, true, true,
    ARRAY['home_cook', 'chef'], 'NGN',
    true, false, 820
  ),
  (
    'cccccccc-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000003',
    'Fatima Pastry Studio', 'fatimapastry',
    'Northern Nigeria meets Parisian pastry. Chin-chin, puff-puff, and custom celebration cakes.',
    'Ikeja, Lagos', 6.5958, 3.3387,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/fatima_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/fatima_kitchen.jpg'],
    4.9, 203, 97,
    true, true, true,
    ARRAY['pastry_chef', 'baker'], 'NGN',
    false, true, 3100
  ),
  (
    'cccccccc-0000-0000-0000-000000000004',
    '11111111-0000-0000-0000-000000000004',
    'Chef Tunde', 'cheftunde',
    'Private chef for events and intimate dinners. Nigerian-Continental fusion. Minimum 10 guests.',
    'Ikoyi, Lagos', 6.4500, 3.4350,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/tunde_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/tunde_kitchen.jpg'],
    5.0, 44, 99,
    true, true, true,
    ARRAY['chef'], 'NGN',
    true, true, 560
  ),
  (
    'cccccccc-0000-0000-0000-000000000005',
    '11111111-0000-0000-0000-000000000005',
    'Ngozi Health Kitchen', 'ngozihealth',
    'Clean eating, real food. Protein meal preps, sugar-free snacks, low-carb Nigerian meals.',
    'Surulere, Lagos', 6.5019, 3.3515,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/ngozi_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/ngozi_kitchen.jpg'],
    4.6, 156, 89,
    true, true, true,
    ARRAY['home_cook'], 'NGN',
    false, false, 2200
  ),
  (
    'cccccccc-0000-0000-0000-000000000006',
    '11111111-0000-0000-0000-000000000006',
    'Amaka Bakes', 'amakabakes',
    'Custom cakes, small chops, and event snacks. Order 48 hours ahead. Surulere delivery.',
    'Surulere, Lagos', 6.4980, 3.3560,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/amaka_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/amaka_kitchen.jpg'],
    4.8, 311, 95,
    true, true, true,
    ARRAY['baker', 'pastry_chef'], 'NGN',
    false, true, 4500
  ),
  (
    'cccccccc-0000-0000-0000-000000000007',
    '11111111-0000-0000-0000-000000000007',
    'Chidi Caterers', 'chidicaters',
    'Corporate and social event catering. Buffet setup, live stations, waiter service available.',
    'Yaba, Lagos', 6.5095, 3.3696,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/chidi_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/chidi_kitchen.jpg'],
    4.7, 67, 92,
    true, true, true,
    ARRAY['caterer'], 'NGN',
    false, true, 710
  ),
  (
    'cccccccc-0000-0000-0000-000000000008',
    '11111111-0000-0000-0000-000000000008',
    'Halima Kitchen', 'halimakitchen',
    'Authentic Hausa-Fulani cuisine. Tuwon Shinkafa, Miyan Kuka, Kilishi. Halal certified.',
    'Agege, Lagos', 6.6177, 3.3218,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/halima_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/halima_kitchen.jpg'],
    4.5, 78, 87,
    true, true, true,
    ARRAY['home_cook'], 'NGN',
    false, false, 640
  ),
  (
    'cccccccc-0000-0000-0000-000000000009',
    '11111111-0000-0000-0000-000000000009',
    'Bola Mixology', 'bolamix',
    'Craft mocktails, zobo cocktails, and Nigerian-inspired drinks for events and daily orders.',
    'Lekki Phase 2, Lagos', 6.4432, 3.5280,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/bola_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/bola_kitchen.jpg'],
    4.9, 95, 96,
    true, true, true,
    ARRAY['mixologist'], 'NGN',
    false, false, 1890
  ),
  (
    'cccccccc-0000-0000-0000-000000000010',
    '11111111-0000-0000-0000-000000000010',
    'Chisom Cookin', 'chisomcookin',
    'Weekday meal prep specialist. 5-day packages for busy professionals. Owerri recipes, Lagos delivery.',
    'Ajah, Lagos', 6.4648, 3.5776,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/chisom_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/chisom_kitchen.jpg'],
    4.7, 132, 90,
    true, true, true,
    ARRAY['home_cook'], 'NGN',
    false, false, 1150
  ),
  (
    'cccccccc-0000-0000-0000-000000000011',
    '11111111-0000-0000-0000-000000000011',
    'Rukayat Suya House', 'rukayatsuya',
    'Night market vibes at home. Suya, nkwobi, asun, and pepper chicken. Order by 4pm for evening.',
    'Maryland, Lagos', 6.5700, 3.3620,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/rukayat_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/rukayat_kitchen.jpg'],
    4.8, 189, 93,
    true, true, true,
    ARRAY['home_cook'], 'NGN',
    false, false, 2800
  ),
  (
    'cccccccc-0000-0000-0000-000000000012',
    '11111111-0000-0000-0000-000000000012',
    'Ifeanyi Culinary Studio', 'ifeanyiculinary',
    'Cooking class instructor and meal kit creator. Learn jollof, egusi, and more from your kitchen.',
    'Gbagada, Lagos', 6.5540, 3.3900,
    'https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/ifeanyi_avatar.jpg',
    ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/ifeanyi_kitchen.jpg'],
    4.9, 56, 98,
    true, true, true,
    ARRAY['culinary_instructor', 'home_cook'], 'NGN',
    false, false, 3700
  )
ON CONFLICT (user_id) DO NOTHING;

-- ── Menu items ───────────────────────────────────────────────
INSERT INTO menu_items (
  id, cook_id, title, description,
  unit_price, currency_code,
  photos, dietary_labels, allergens,
  is_active, is_available, realtime_available,
  available_slots, min_order_qty, max_order_qty,
  prep_time_minutes
) VALUES
  -- Ada Kitchen
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'Ofe Onugbu (Bitter Leaf Soup)', 'Rich, authentic Igbo bitter leaf soup with assorted meat. Served with pounded yam or eba.',
   4500, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/ofe_onugbu.jpg'],
   ARRAY[]::text[], ARRAY[]::text[], true, true, false, 20, 1, 5, 45),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001',
   'Egusi Soup + Pounded Yam', 'Freshly ground egusi cooked with stockfish and fresh meat. Smooth, silky pounded yam.',
   4200, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/egusi.jpg'],
   ARRAY[]::text[], ARRAY['tree_nuts']::text[], true, true, false, 15, 1, 4, 50),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001',
   'Banga Soup + Starch', 'Delta-style palm nut soup with tilapia fish. Served with traditional yellow starch.',
   5000, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/banga.jpg'],
   ARRAY['gluten_free']::text[], ARRAY['fish']::text[], true, true, false, 10, 1, 3, 60),

  -- Emeka Smoky Grill
  ('aaaaaaaa-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000002',
   'Beef Suya (500g)', 'Spiced, wood-smoked suya. Served with raw onion, tomatoes, and yaji spice.',
   3500, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/suya.jpg'],
   ARRAY['gluten_free']::text[], ARRAY['nuts']::text[], true, true, true, 30, 1, 5, 30),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000002',
   'Catfish Pepper Soup', 'Fresh point-and-kill catfish in peppery, aromatic broth. Lagos street-style.',
   4800, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/catfish_pepper.jpg'],
   ARRAY['gluten_free']::text[], ARRAY['fish']::text[], true, true, false, 12, 1, 3, 40),

  -- Fatima Pastry Studio
  ('aaaaaaaa-0000-0000-0000-000000000006', 'cccccccc-0000-0000-0000-000000000003',
   'Chin-Chin (500g)', 'Crunchy, golden chin-chin. Plain, coconut, and suya-spice flavours in one bag.',
   2500, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/chinchin.jpg'],
   ARRAY['vegetarian']::text[], ARRAY['gluten', 'eggs']::text[], true, true, true, 50, 1, 10, 20),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000003',
   'Custom Celebration Cake (per slice)', 'Fluffy sponge with buttercream frosting. Customisable message. Min 1kg cake order.',
   3000, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/cake.jpg'],
   ARRAY['vegetarian']::text[], ARRAY['gluten', 'dairy', 'eggs']::text[], true, true, false, 8, 1, 12, 120),

  -- Ngozi Health Kitchen
  ('aaaaaaaa-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000005',
   'Weekly Protein Meal Prep (5 days)', 'Mon-Fri meal prep boxes. Chicken, fish, and plant protein options. Macro-counted.',
   22000, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/mealprep.jpg'],
   ARRAY['gluten_free', 'high_protein']::text[], ARRAY[]::text[], true, true, false, 10, 1, 2, 180),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'cccccccc-0000-0000-0000-000000000005',
   'Low-Carb Jollof Rice Bowl', 'Cauliflower jollof with grilled chicken and a side of coleslaw. 350 kcal.',
   3800, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/lowcarb_jollof.jpg'],
   ARRAY['gluten_free', 'low_carb']::text[], ARRAY[]::text[], true, true, false, 15, 1, 4, 35),

  -- Amaka Bakes
  ('aaaaaaaa-0000-0000-0000-000000000010', 'cccccccc-0000-0000-0000-000000000006',
   'Small Chops Party Pack (50 pcs)', 'Samosa, spring rolls, puff-puff, and mini sausage rolls. Perfect for events.',
   18000, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/small_chops.jpg'],
   ARRAY['vegetarian_option']::text[], ARRAY['gluten', 'eggs']::text[], true, true, false, 5, 1, 3, 90),

  -- Halima Kitchen
  ('aaaaaaaa-0000-0000-0000-000000000011', 'cccccccc-0000-0000-0000-000000000008',
   'Tuwon Shinkafa + Miyan Kuka', 'Northern Nigeria comfort food. Silky rice tuwo with baobab leaf soup. Halal meat.',
   3500, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/tuwo.jpg'],
   ARRAY['gluten_free', 'halal']::text[], ARRAY[]::text[], true, true, false, 12, 1, 4, 50),
  ('aaaaaaaa-0000-0000-0000-000000000012', 'cccccccc-0000-0000-0000-000000000008',
   'Kilishi (150g pack)', 'Sun-dried, spiced beef jerky from Kano. Classic Nigerian snack. Halal.',
   2800, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/kilishi.jpg'],
   ARRAY['gluten_free', 'halal']::text[], ARRAY['nuts']::text[], true, true, true, 40, 1, 5, 10),

  -- Bola Mixology
  ('aaaaaaaa-0000-0000-0000-000000000013', 'cccccccc-0000-0000-0000-000000000009',
   'Zobo Hibiscus Cocktail (1L)', 'Hibiscus-ginger zobo with a secret citrus blend. No alcohol. Spice level: medium.',
   2200, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/zobo.jpg'],
   ARRAY['vegan', 'gluten_free']::text[], ARRAY[]::text[], true, true, true, 30, 1, 6, 15),

  -- Rukayat Suya House
  ('aaaaaaaa-0000-0000-0000-000000000014', 'cccccccc-0000-0000-0000-000000000011',
   'Asun (Peppered Goat Meat)', 'Grilled and peppered goat meat. Tender, smoky, well-seasoned. Lagos night-out classic.',
   4000, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/asun.jpg'],
   ARRAY['gluten_free']::text[], ARRAY[]::text[], true, true, false, 15, 1, 4, 45),
  ('aaaaaaaa-0000-0000-0000-000000000015', 'cccccccc-0000-0000-0000-000000000011',
   'Nkwobi (Cow Foot)', 'Slow-cooked cow foot in palm-oil utazi leaf sauce. Authentic south-eastern street food.',
   5500, 'NGN', ARRAY['https://res.cloudinary.com/FOODsbyme/image/upload/v1/seeds/nkwobi.jpg'],
   ARRAY['gluten_free']::text[], ARRAY[]::text[], true, true, false, 8, 1, 3, 90)
ON CONFLICT (id) DO NOTHING;

COMMIT;
