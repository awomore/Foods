const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/menu/cook/:cookId ──────────────────────────────────────────────
router.get('/cook/:cookId', async (req, res) => {
  try {
    const { cookId } = req.params;
    const { date, mode, week_start } = req.query;

    let items;
    if (week_start) {
      items = await sql`
        SELECT mi.*
        FROM menu_items mi
        JOIN weekly_meal_plans wmp ON wmp.id = mi.meal_plan_id
        WHERE wmp.cook_id = ${cookId}
          AND wmp.week_start_date = ${week_start}::date
          AND wmp.is_published = true
          AND mi.is_active = true
        ORDER BY mi.available_date ASC, mi.created_at DESC
      `;
    } else {
      items = await sql`
        SELECT * FROM menu_items
        WHERE cook_id = ${cookId}
          AND is_active = true
          AND (${date ?? null}::date IS NULL OR available_date = ${date ?? null}::date)
          AND (${mode ?? null}::text IS NULL OR mode = ${mode ?? null})
        ORDER BY available_date ASC, created_at DESC
      `;
    }

    res.json({ items });
  } catch (err) {
    console.error('GET /menu/cook/:cookId:', err);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// ── GET /api/menu/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const items = await sql`
      SELECT mi.*, cp.display_name AS cook_name, cp.username AS cook_username,
             cp.average_rating, cp.repeat_order_rate, cp.location AS cook_location
      FROM menu_items mi
      JOIN cook_profiles cp ON cp.id = mi.cook_id
      WHERE mi.id = ${req.params.id} AND mi.is_active = true
    `;
    if (!items.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: items[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// ── POST /api/menu ──────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const {
      title, description, cook_note, cuisine_type, ethnic_tags,
      ingredients, allergens, photos, unit_price, currency_code,
      sides, total_slots, available_date,
      delivery_window_start, delivery_window_end,
      realtime_available, realtime_slots,
      is_surprise_drop, is_gold_early_access, gold_early_access_until,
      is_store_item, store_inventory,
      mode, meal_plan_id,
    } = req.body;

    if (!title || !unit_price || !photos?.length) {
      return res.status(400).json({ error: 'title, unit_price, and photos are required' });
    }

    const item = await sql`
      INSERT INTO menu_items (
        cook_id, meal_plan_id, mode, title, description, cook_note,
        cuisine_type, ethnic_tags, ingredients, allergens,
        photos, unit_price, currency_code, sides,
        total_slots, available_date,
        delivery_window_start, delivery_window_end,
        realtime_available, realtime_slots,
        is_surprise_drop, is_gold_early_access, gold_early_access_until,
        is_store_item, store_inventory
      ) VALUES (
        ${cookId}, ${meal_plan_id ?? null}, ${mode ?? 'meals'},
        ${title}, ${description ?? null}, ${cook_note ?? null},
        ${cuisine_type ?? null},
        ${ethnic_tags ?? []}::text[],
        ${ingredients ?? []}::text[],
        ${allergens ?? []}::text[],
        ${photos}::text[],
        ${parseFloat(unit_price)},
        ${currency_code ?? 'NGN'},
        ${sides ? JSON.stringify(sides) : '[]'}::jsonb,
        ${parseInt(total_slots ?? 10)},
        ${available_date ?? null}::date,
        ${delivery_window_start ?? null}::timestamptz,
        ${delivery_window_end ?? null}::timestamptz,
        ${!!realtime_available},
        ${parseInt(realtime_slots ?? 0)},
        ${!!is_surprise_drop},
        ${!!is_gold_early_access},
        ${gold_early_access_until ?? null}::timestamptz,
        ${!!is_store_item},
        ${store_inventory ?? null}
      )
      RETURNING *
    `;

    res.status(201).json({ item: item[0] });
  } catch (err) {
    console.error('POST /menu:', err);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// ── PATCH /api/menu/:id ─────────────────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const items = await sql`SELECT cook_id FROM menu_items WHERE id = ${req.params.id}`;
    if (!items.length) return res.status(404).json({ error: 'Item not found' });
    if (items[0].cook_id !== cooks[0].id) return res.status(403).json({ error: 'Forbidden' });

    const {
      title, description, cook_note, cuisine_type, ethnic_tags,
      ingredients, allergens, photos, unit_price, sides,
      total_slots, available_date,
      delivery_window_start, delivery_window_end,
      realtime_available, realtime_slots, is_active,
    } = req.body;

    const updated = await sql`
      UPDATE menu_items SET
        title                = COALESCE(${title ?? null},               title),
        description          = COALESCE(${description ?? null},         description),
        cook_note            = COALESCE(${cook_note ?? null},           cook_note),
        cuisine_type         = COALESCE(${cuisine_type ?? null},        cuisine_type),
        ethnic_tags          = COALESCE(${ethnic_tags ?? null}::text[], ethnic_tags),
        ingredients          = COALESCE(${ingredients ?? null}::text[], ingredients),
        allergens            = COALESCE(${allergens ?? null}::text[],   allergens),
        photos               = COALESCE(${photos ?? null}::text[],      photos),
        unit_price           = COALESCE(${unit_price ?? null}::numeric, unit_price),
        sides                = COALESCE(${sides ? JSON.stringify(sides) : null}::jsonb, sides),
        total_slots          = COALESCE(${total_slots ?? null}::int,    total_slots),
        available_date       = COALESCE(${available_date ?? null}::date, available_date),
        delivery_window_start= COALESCE(${delivery_window_start ?? null}::timestamptz, delivery_window_start),
        delivery_window_end  = COALESCE(${delivery_window_end ?? null}::timestamptz,   delivery_window_end),
        realtime_available   = COALESCE(${realtime_available ?? null},  realtime_available),
        realtime_slots       = COALESCE(${realtime_slots ?? null}::int, realtime_slots),
        is_active            = COALESCE(${is_active ?? null},           is_active),
        updated_at           = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    res.json({ item: updated[0] });
  } catch (err) {
    console.error('PATCH /menu/:id:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// ── DELETE /api/menu/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const items = await sql`SELECT cook_id FROM menu_items WHERE id = ${req.params.id}`;
    if (!items.length) return res.status(404).json({ error: 'Item not found' });
    if (items[0].cook_id !== cooks[0].id) return res.status(403).json({ error: 'Forbidden' });

    await sql`UPDATE menu_items SET is_active = false WHERE id = ${req.params.id}`;
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// ── POST /api/menu/meal-plans ───────────────────────────────────────────────
router.post('/meal-plans', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const { week_start_date } = req.body;
    if (!week_start_date) return res.status(400).json({ error: 'week_start_date required' });

    const plan = await sql`
      INSERT INTO weekly_meal_plans (cook_id, week_start_date)
      VALUES (${cookId}, ${week_start_date}::date)
      ON CONFLICT (cook_id, week_start_date) DO UPDATE SET cook_id = ${cookId}
      RETURNING *
    `;

    res.status(201).json({ meal_plan: plan[0] });
  } catch (err) {
    console.error('POST /menu/meal-plans:', err);
    res.status(500).json({ error: 'Failed to create meal plan' });
  }
});

// ── PATCH /api/menu/meal-plans/:id/publish ──────────────────────────────────
router.patch('/meal-plans/:id/publish', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const plans = await sql`SELECT cook_id FROM weekly_meal_plans WHERE id = ${req.params.id}`;
    if (!plans.length || plans[0].cook_id !== cooks[0].id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await sql`
      UPDATE weekly_meal_plans
      SET is_published = true, published_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    res.json({ meal_plan: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish meal plan' });
  }
});

module.exports = router;
