const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/chef-service-settings/:cookId — public ──────────────────────────
router.get('/:cookId', async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM chef_service_settings WHERE cook_id = ${req.params.cookId}
    `;
    res.json({ settings: rows[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chef service settings' });
  }
});

// ── GET /api/chef-service-settings/my — cook sees own settings ───────────────
router.get('/my/profile', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.json({ settings: null });

    const rows = await sql`
      SELECT * FROM chef_service_settings WHERE cook_id = ${cooks[0].id}
    `;
    res.json({ settings: rows[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ── PUT /api/chef-service-settings/geography — update geography config ────────
router.put('/geography', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const {
      cities_served,
      states_served,
      travel_radius_km,
      nationwide,
      travel_fee_flat,
      travel_fee_per_km,
    } = req.body;

    const [settings] = await sql`
      INSERT INTO chef_service_settings (cook_id,
        cities_served, states_served, travel_radius_km, nationwide, travel_fee_flat, travel_fee_per_km,
        hourly_rate, day_rate, event_rate, minimum_spend, guest_tiers,
        notice_hours, deposit_pct, ingredients_by_client, accommodation_required)
      VALUES (
        ${cookId},
        ${cities_served ?? []}::text[],
        ${states_served ?? []}::text[],
        ${travel_radius_km ?? 50},
        ${nationwide ?? false},
        ${travel_fee_flat ?? null},
        ${travel_fee_per_km ?? null},
        null, null, null, null, '[]'::jsonb,
        48, 30, false, false
      )
      ON CONFLICT (cook_id) DO UPDATE SET
        cities_served     = EXCLUDED.cities_served,
        states_served     = EXCLUDED.states_served,
        travel_radius_km  = EXCLUDED.travel_radius_km,
        nationwide        = EXCLUDED.nationwide,
        travel_fee_flat   = EXCLUDED.travel_fee_flat,
        travel_fee_per_km = EXCLUDED.travel_fee_per_km,
        updated_at        = now()
      RETURNING *
    `;
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update geography' });
  }
});

// ── PUT /api/chef-service-settings/pricing — update rates + guest tiers ──────
router.put('/pricing', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const {
      hourly_rate,
      day_rate,
      event_rate,
      minimum_spend,
      guest_tiers, // [{min_guests, max_guests, rate_per_head, flat_rate, label}]
    } = req.body;

    const [settings] = await sql`
      INSERT INTO chef_service_settings (cook_id,
        hourly_rate, day_rate, event_rate, minimum_spend, guest_tiers,
        cities_served, states_served, travel_radius_km, nationwide,
        notice_hours, deposit_pct, ingredients_by_client, accommodation_required)
      VALUES (
        ${cookId},
        ${hourly_rate ?? null},
        ${day_rate ?? null},
        ${event_rate ?? null},
        ${minimum_spend ?? null},
        ${JSON.stringify(guest_tiers ?? [])}::jsonb,
        '{}'::text[], '{}'::text[], 50, false,
        48, 30, false, false
      )
      ON CONFLICT (cook_id) DO UPDATE SET
        hourly_rate   = EXCLUDED.hourly_rate,
        day_rate      = EXCLUDED.day_rate,
        event_rate    = EXCLUDED.event_rate,
        minimum_spend = EXCLUDED.minimum_spend,
        guest_tiers   = EXCLUDED.guest_tiers,
        updated_at    = now()
      RETURNING *
    `;
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// ── PUT /api/chef-service-settings/requirements — update requirements ─────────
router.put('/requirements', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const {
      notice_hours,
      deposit_pct,
      equipment_notes,
      kitchen_notes,
      ingredients_by_client,
      accommodation_required,
    } = req.body;

    const [settings] = await sql`
      INSERT INTO chef_service_settings (cook_id,
        notice_hours, deposit_pct, equipment_notes, kitchen_notes,
        ingredients_by_client, accommodation_required,
        cities_served, states_served, travel_radius_km, nationwide,
        hourly_rate, day_rate, event_rate, minimum_spend, guest_tiers)
      VALUES (
        ${cookId},
        ${notice_hours ?? 48},
        ${deposit_pct ?? 30},
        ${equipment_notes ?? null},
        ${kitchen_notes ?? null},
        ${ingredients_by_client ?? false},
        ${accommodation_required ?? false},
        '{}'::text[], '{}'::text[], 50, false,
        null, null, null, null, '[]'::jsonb
      )
      ON CONFLICT (cook_id) DO UPDATE SET
        notice_hours           = EXCLUDED.notice_hours,
        deposit_pct            = EXCLUDED.deposit_pct,
        equipment_notes        = EXCLUDED.equipment_notes,
        kitchen_notes          = EXCLUDED.kitchen_notes,
        ingredients_by_client  = EXCLUDED.ingredients_by_client,
        accommodation_required = EXCLUDED.accommodation_required,
        updated_at             = now()
      RETURNING *
    `;
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update requirements' });
  }
});

module.exports = router;
