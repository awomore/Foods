const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/health/customer/profile ─────────────────────────────────────────
router.get('/customer/profile', authenticate, async (req, res) => {
  try {
    const customers = await sql`SELECT id FROM customer_profiles WHERE user_id = ${req.user.id}`;
    if (!customers.length) return res.json({ health_profile: null });

    const profile = await sql`
      SELECT * FROM customer_health_profiles WHERE customer_id = ${customers[0].id}
    `;
    res.json({ health_profile: profile[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health profile' });
  }
});

// ── PATCH /api/health/customer/profile ───────────────────────────────────────
router.patch('/customer/profile', authenticate, async (req, res) => {
  try {
    const customers = await sql`
      INSERT INTO customer_profiles (user_id)
      VALUES (${req.user.id})
      ON CONFLICT (user_id) DO UPDATE SET user_id = ${req.user.id}
      RETURNING id
    `;
    const customerId = customers[0].id;

    const { allergens, dietary_preferences, health_goals, health_notes, is_visible_to_cooks } = req.body;

    const profile = await sql`
      INSERT INTO customer_health_profiles (customer_id, allergens, dietary_preferences, health_goals, health_notes, is_visible_to_cooks)
      VALUES (
        ${customerId},
        ${allergens ?? []}::text[],
        ${dietary_preferences ?? []}::text[],
        ${health_goals ?? []}::text[],
        ${health_notes ?? null},
        ${is_visible_to_cooks ?? false}
      )
      ON CONFLICT (customer_id) DO UPDATE SET
        allergens = COALESCE(${allergens ?? null}::text[], customer_health_profiles.allergens),
        dietary_preferences = COALESCE(${dietary_preferences ?? null}::text[], customer_health_profiles.dietary_preferences),
        health_goals = COALESCE(${health_goals ?? null}::text[], customer_health_profiles.health_goals),
        health_notes = COALESCE(${health_notes ?? null}, customer_health_profiles.health_notes),
        is_visible_to_cooks = COALESCE(${is_visible_to_cooks ?? null}, customer_health_profiles.is_visible_to_cooks),
        updated_at = NOW()
      RETURNING *
    `;

    res.json({ health_profile: profile[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update health profile' });
  }
});

// ── GET /api/health/kitchens ─────────────────────────────────────────────────
// List Health Kitchen approved cooks
router.get('/kitchens', async (req, res) => {
  try {
    const { specialisation, lat, lng, limit = 20 } = req.query;
    const hasGeo = !!(lat && lng);
    const latN = hasGeo ? parseFloat(lat) : null;
    const lngN = hasGeo ? parseFloat(lng) : null;

    const kitchens = await sql`
      SELECT cp.*, u.full_name, u.avatar_url,
        ${hasGeo ? sql`
          ROUND((
            6371 * acos(
              cos(radians(${latN})) * cos(radians(cp.latitude))
              * cos(radians(cp.longitude) - radians(${lngN}))
              + sin(radians(${latN})) * sin(radians(cp.latitude))
            )
          )::numeric, 1)
        ` : sql`0::numeric`} AS distance_km
      FROM cook_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.is_health_kitchen = true
        AND cp.approved_as_health_kitchen = true
        AND cp.verification_status = 'approved'
        AND (${specialisation ?? null}::text IS NULL OR EXISTS (
          SELECT 1 FROM cook_health_specialisations chs
          WHERE chs.cook_id = cp.id AND chs.specialisation = ${specialisation ?? null}
        ))
      ORDER BY cp.average_rating DESC
      LIMIT ${parseInt(limit)}
    `;

    res.json({ kitchens });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Health Kitchens' });
  }
});

// ── GET /api/health/kitchens/:cookId/subscribe ───────────────────────────────
router.post('/kitchens/:cookId/subscribe', authenticate, async (req, res) => {
  try {
    const customers = await sql`
      INSERT INTO customer_profiles (user_id) VALUES (${req.user.id})
      ON CONFLICT (user_id) DO UPDATE SET user_id = ${req.user.id}
      RETURNING id
    `;
    const customerId = customers[0].id;

    const sub = await sql`
      INSERT INTO health_subscriptions (customer_id, cook_id)
      VALUES (${customerId}, ${req.params.cookId})
      ON CONFLICT (customer_id, cook_id) DO UPDATE SET status = 'active'
      RETURNING *
    `;
    res.status(201).json({ subscription: sub[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

module.exports = router;
