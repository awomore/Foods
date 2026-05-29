const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/cooks ──────────────────────────────────────────────────────────
// List cooks, optionally filtered by proximity / mode / health
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius = 20, mode, health, limit = 30, offset = 0 } = req.query;

    let cooks;
    if (lat && lng) {
      const latN = parseFloat(lat);
      const lngN = parseFloat(lng);
      const radKm = parseFloat(radius);
      cooks = await sql`
        SELECT
          cp.*,
          u.full_name, u.avatar_url, u.country_code,
          ROUND((
            6371 * acos(
              cos(radians(${latN})) * cos(radians(cp.latitude))
              * cos(radians(cp.longitude) - radians(${lngN}))
              + sin(radians(${latN})) * sin(radians(cp.latitude))
            )
          )::numeric, 1) AS distance_km
        FROM cook_profiles cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.verification_status = 'approved'
          AND (${mode ?? null}::text IS NULL OR EXISTS (
            SELECT 1 FROM cook_modes cm
            WHERE cm.cook_id = cp.id AND cm.mode = ${mode ?? null} AND cm.is_enabled = true
          ))
          AND (${health === 'true' ? 'true' : null}::boolean IS NULL
               OR cp.is_health_kitchen = true)
          AND cp.latitude IS NOT NULL AND cp.longitude IS NOT NULL
          AND (
            6371 * acos(
              cos(radians(${latN})) * cos(radians(cp.latitude))
              * cos(radians(cp.longitude) - radians(${lngN}))
              + sin(radians(${latN})) * sin(radians(cp.latitude))
            )
          ) <= ${radKm}
        ORDER BY distance_km ASC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    } else {
      cooks = await sql`
        SELECT cp.*, u.full_name, u.avatar_url, u.country_code, 0 AS distance_km
        FROM cook_profiles cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.verification_status = 'approved'
          AND (${mode ?? null}::text IS NULL OR EXISTS (
            SELECT 1 FROM cook_modes cm
            WHERE cm.cook_id = cp.id AND cm.mode = ${mode ?? null} AND cm.is_enabled = true
          ))
          AND (${health === 'true' ? 'true' : null}::boolean IS NULL
               OR cp.is_health_kitchen = true)
        ORDER BY cp.average_rating DESC, cp.total_orders DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
    }

    if (!cooks.length) return res.json({ cooks: [], total: 0 });

    const cookIds = cooks.map(c => c.id);

    // Today's items per cook
    const todayItems = await sql`
      SELECT * FROM menu_items
      WHERE cook_id = ANY(${cookIds}::uuid[])
        AND is_active = true
        AND (available_date = CURRENT_DATE OR realtime_available = true)
        AND slots_claimed < total_slots
      ORDER BY created_at DESC
    `;

    // Enabled modes per cook
    const modes = await sql`
      SELECT cook_id, mode FROM cook_modes
      WHERE cook_id = ANY(${cookIds}::uuid[]) AND is_enabled = true
    `;

    // Active discounts per cook
    const discounts = await sql`
      SELECT * FROM cook_discounts
      WHERE cook_id = ANY(${cookIds}::uuid[])
        AND is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at > NOW())
    `;

    const itemsByC = todayItems.reduce((a, i) => { (a[i.cook_id] ??= []).push(i); return a; }, {});
    const modesByC = modes.reduce((a, m) => { (a[m.cook_id] ??= []).push(m.mode); return a; }, {});
    const discByC  = discounts.reduce((a, d) => { (a[d.cook_id] ??= []).push(d); return a; }, {});

    const result = cooks.map(c => ({
      ...c,
      today_items:     itemsByC[c.id] ?? [],
      enabled_modes:   modesByC[c.id] ?? [],
      active_discounts: discByC[c.id] ?? [],
    }));

    res.json({ cooks: result, total: result.length });
  } catch (err) {
    console.error('GET /cooks:', err);
    res.status(500).json({ error: 'Failed to fetch cooks' });
  }
});

// ── GET /api/cooks/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const cooks = await sql`
      SELECT cp.*, u.full_name, u.avatar_url, u.country_code
      FROM cook_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.id = ${id} OR cp.username = ${id}
    `;
    if (!cooks.length) return res.status(404).json({ error: 'Cook not found' });
    const cook = cooks[0];

    const [modes, specs, todayItems, realtimeItems, weekPlan, discounts] = await Promise.all([
      sql`SELECT mode FROM cook_modes WHERE cook_id = ${cook.id} AND is_enabled = true`,
      sql`SELECT specialisation FROM cook_health_specialisations WHERE cook_id = ${cook.id}`,
      sql`SELECT * FROM menu_items WHERE cook_id = ${cook.id} AND is_active = true AND available_date = CURRENT_DATE ORDER BY created_at DESC`,
      sql`SELECT * FROM menu_items WHERE cook_id = ${cook.id} AND is_active = true AND realtime_available = true AND realtime_slots_claimed < realtime_slots ORDER BY created_at DESC`,
      sql`
        SELECT wmp.*, json_agg(mi.* ORDER BY mi.available_date) FILTER (WHERE mi.id IS NOT NULL) AS items
        FROM weekly_meal_plans wmp
        LEFT JOIN menu_items mi ON mi.meal_plan_id = wmp.id AND mi.is_active = true
        WHERE wmp.cook_id = ${cook.id}
          AND wmp.week_start_date >= date_trunc('week', CURRENT_DATE)
          AND wmp.is_published = true
        GROUP BY wmp.id
        ORDER BY wmp.week_start_date DESC
        LIMIT 1
      `,
      sql`
        SELECT * FROM cook_discounts
        WHERE cook_id = ${cook.id} AND is_active = true
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at > NOW())
      `,
    ]);

    res.json({
      cook: {
        ...cook,
        enabled_modes: modes.map(m => m.mode),
        health_specialisations: specs.map(s => s.specialisation),
        active_discounts: discounts,
      },
      today_items:    todayItems,
      realtime_items: realtimeItems,
      week_plan:      weekPlan[0] ?? null,
    });
  } catch (err) {
    console.error('GET /cooks/:id:', err);
    res.status(500).json({ error: 'Failed to fetch cook' });
  }
});

// ── PATCH /api/cooks/:id ────────────────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const cooks = await sql`SELECT user_id FROM cook_profiles WHERE id = ${id}`;
    if (!cooks.length || cooks[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      display_name, bio, location, admin_area,
      storefront_title, storefront_bio,
      open_time_default, close_time_default, open_hours_by_day,
      is_accepting_tips, instagram_handle, tiktok_handle, youtube_url, twitter_handle,
      bank_name, bank_code, bank_account_number, bank_account_name,
    } = req.body;

    const updated = await sql`
      UPDATE cook_profiles SET
        display_name        = COALESCE(${display_name ?? null},   display_name),
        bio                 = COALESCE(${bio ?? null},            bio),
        location            = COALESCE(${location ?? null},       location),
        admin_area          = COALESCE(${admin_area ?? null},     admin_area),
        storefront_title    = COALESCE(${storefront_title ?? null}, storefront_title),
        storefront_bio      = COALESCE(${storefront_bio ?? null}, storefront_bio),
        open_time_default   = COALESCE(${open_time_default ?? null}, open_time_default),
        close_time_default  = COALESCE(${close_time_default ?? null}, close_time_default),
        open_hours_by_day   = COALESCE(${open_hours_by_day ? JSON.stringify(open_hours_by_day) : null}::jsonb, open_hours_by_day),
        is_accepting_tips   = COALESCE(${is_accepting_tips ?? null}, is_accepting_tips),
        instagram_handle    = COALESCE(${instagram_handle ?? null}, instagram_handle),
        tiktok_handle       = COALESCE(${tiktok_handle ?? null},  tiktok_handle),
        youtube_url         = COALESCE(${youtube_url ?? null},    youtube_url),
        twitter_handle      = COALESCE(${twitter_handle ?? null}, twitter_handle),
        bank_name           = COALESCE(${bank_name ?? null},      bank_name),
        bank_code           = COALESCE(${bank_code ?? null},      bank_code),
        bank_account_number = COALESCE(${bank_account_number ?? null}, bank_account_number),
        bank_account_name   = COALESCE(${bank_account_name ?? null}, bank_account_name)
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({ cook: updated[0] });
  } catch (err) {
    console.error('PATCH /cooks/:id:', err);
    res.status(500).json({ error: 'Failed to update cook' });
  }
});

// ── POST /api/cooks/onboard ─────────────────────────────────────────────────
router.post('/onboard', authenticate, async (req, res) => {
  try {
    const {
      display_name, username, pronouns,
      location, admin_area, latitude, longitude, bio,
      bank_name, bank_code, bank_account_number, bank_account_name,
      instagram_handle, tiktok_handle, youtube_url, twitter_handle,
      kitchen_photos, profile_video_url,
    } = req.body;

    if (!display_name || !username) {
      return res.status(400).json({ error: 'display_name and username are required' });
    }

    // Username must match at least one social handle to prevent impersonation
    const handles = [instagram_handle, tiktok_handle, twitter_handle]
      .filter(Boolean)
      .map(h => h.replace(/^@/, '').trim().toLowerCase());
    if (handles.length === 0) {
      return res.status(400).json({ error: 'At least one social handle (Instagram, TikTok, or Twitter) is required to claim a username.' });
    }
    if (!handles.includes(username.toLowerCase())) {
      return res.status(400).json({ error: `Your username must exactly match one of your social handles (${handles.join(', ')}). This protects popular creators from impersonation.` });
    }

    const taken = await sql`SELECT id FROM cook_profiles WHERE username = ${username}`;
    if (taken.length) return res.status(409).json({ error: 'Username already taken' });

    const profile = await sql`
      INSERT INTO cook_profiles (
        user_id, display_name, username, pronouns,
        location, admin_area, latitude, longitude, bio,
        bank_name, bank_code, bank_account_number, bank_account_name,
        instagram_handle, tiktok_handle, youtube_url, twitter_handle,
        kitchen_photos, profile_video_url, verification_status
      ) VALUES (
        ${req.user.id}, ${display_name}, ${username}, ${pronouns ?? 'she_her'},
        ${location ?? null}, ${admin_area ?? null},
        ${latitude ?? null}, ${longitude ?? null}, ${bio ?? null},
        ${bank_name ?? null}, ${bank_code ?? null}, ${bank_account_number ?? null}, ${bank_account_name ?? null},
        ${instagram_handle ?? null}, ${tiktok_handle ?? null}, ${youtube_url ?? null}, ${twitter_handle ?? null},
        ${kitchen_photos ?? []}::text[], ${profile_video_url ?? null},
        'pending'
      )
      RETURNING *
    `;

    await sql`UPDATE users SET role = 'cook' WHERE id = ${req.user.id}`;
    res.status(201).json({ cook: profile[0] });
  } catch (err) {
    console.error('POST /cooks/onboard:', err);
    res.status(500).json({ error: 'Failed to create cook profile' });
  }
});

// ── PATCH /api/cooks/:id/live ───────────────────────────────────────────────
router.patch('/:id/live', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_live } = req.body;

    const cooks = await sql`SELECT user_id FROM cook_profiles WHERE id = ${id}`;
    if (!cooks.length || cooks[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await sql`UPDATE cook_profiles SET is_live = ${!!is_live} WHERE id = ${id}`;
    res.json({ is_live: !!is_live });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update live status' });
  }
});

// ── GET /api/cooks/:id/menu ─────────────────────────────────────────────────
// All published menu items for a cook (not just today)
router.get('/:id/menu', async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    const items = await sql`
      SELECT * FROM menu_items
      WHERE cook_id = ${id}
        AND is_active = true
        AND (${from_date ?? null}::date IS NULL OR available_date >= ${from_date ?? null}::date)
        AND (${to_date ?? null}::date IS NULL OR available_date <= ${to_date ?? null}::date)
      ORDER BY available_date ASC, created_at DESC
    `;

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

module.exports = router;
