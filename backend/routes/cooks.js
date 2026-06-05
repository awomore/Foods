const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { sendPushNotifications } = require('./stories');

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
        ORDER BY
          cp.is_live DESC,
          (EXISTS(SELECT 1 FROM stories s WHERE s.cook_id = cp.id AND s.is_active = true AND s.expires_at > NOW()))::int DESC,
          distance_km ASC
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
        ORDER BY
          cp.is_live DESC,
          (EXISTS(SELECT 1 FROM stories s WHERE s.cook_id = cp.id AND s.is_active = true AND s.expires_at > NOW()))::int DESC,
          cp.average_rating DESC,
          cp.total_orders DESC
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

    // Active story counts per cook
    const storyCounts = await sql`
      SELECT cook_id, COUNT(*) AS story_count
      FROM stories
      WHERE cook_id = ANY(${cookIds}::uuid[])
        AND is_active = true AND expires_at > NOW()
      GROUP BY cook_id
    `;

    const itemsByC   = todayItems.reduce((a, i) => { (a[i.cook_id] ??= []).push(i); return a; }, {});
    const modesByC   = modes.reduce((a, m) => { (a[m.cook_id] ??= []).push(m.mode); return a; }, {});
    const discByC    = discounts.reduce((a, d) => { (a[d.cook_id] ??= []).push(d); return a; }, {});
    const storyByC   = storyCounts.reduce((a, s) => { a[s.cook_id] = parseInt(s.story_count); return a; }, {});

    const result = cooks.map(({ instagram_handle, tiktok_handle, youtube_url, twitter_handle, ...c }) => ({
      ...c,
      today_items:      itemsByC[c.id] ?? [],
      enabled_modes:    modesByC[c.id] ?? [],
      active_discounts: discByC[c.id] ?? [],
      has_story:        (storyByC[c.id] ?? 0) > 0,
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
    const { instagram_handle, tiktok_handle, youtube_url, twitter_handle, ...cook } = cooks[0];

    const [modes, specs, todayItems, realtimeItems, weekPlan, discounts, storyRows] = await Promise.all([
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
      sql`SELECT COUNT(*) AS cnt FROM stories WHERE cook_id = ${cook.id} AND is_active = true AND expires_at > NOW()`,
    ]);

    res.json({
      cook: {
        ...cook,
        enabled_modes: modes.map(m => m.mode),
        health_specialisations: specs.map(s => s.specialisation),
        active_discounts: discounts,
        has_story: parseInt(storyRows[0]?.cnt ?? 0) > 0,
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
      location, lga, latitude, longitude, bio,
      bank_name, bank_code, bank_account_number, bank_account_name,
      instagram_handle, tiktok_handle, youtube_url, twitter_handle,
      kitchen_photos, profile_video_url,
    } = req.body;

    if (!display_name || !username) {
      return res.status(400).json({ error: 'display_name and username are required' });
    }

    // If social handles are provided, the username must match one to prevent impersonation
    const handles = [instagram_handle, tiktok_handle, twitter_handle]
      .filter(Boolean)
      .map(h => h.replace(/^@/, '').trim().toLowerCase());
    if (handles.length > 0 && !handles.includes(username.toLowerCase())) {
      return res.status(400).json({ error: `Your username must exactly match one of your social handles (${handles.join(', ')}). This protects popular creators from impersonation.` });
    }

    // Allow the cook to reuse their own username; only block if taken by someone else
    const taken = await sql`SELECT id FROM cook_profiles WHERE username = ${username} AND user_id != ${req.user.id}`;
    if (taken.length) return res.status(409).json({ error: 'Username already taken' });

    // UPSERT — safe to call multiple times (e.g. user re-runs onboarding or skips bank)
    const existing = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;

    let profile;
    if (existing.length) {
      profile = await sql`
        UPDATE cook_profiles SET
          display_name = ${display_name}, username = ${username}, pronouns = ${pronouns ?? 'she_her'},
          location = COALESCE(${location ?? null}, location),
          bio = COALESCE(${bio ?? null}, bio),
          bank_name = COALESCE(${bank_name ?? null}, bank_name),
          bank_code = COALESCE(${bank_code ?? null}, bank_code),
          bank_account_number = COALESCE(${bank_account_number ?? null}, bank_account_number),
          bank_account_name = COALESCE(${bank_account_name ?? null}, bank_account_name),
          instagram_handle = COALESCE(${instagram_handle ?? null}, instagram_handle),
          tiktok_handle = COALESCE(${tiktok_handle ?? null}, tiktok_handle),
          twitter_handle = COALESCE(${twitter_handle ?? null}, twitter_handle),
          youtube_url = COALESCE(${youtube_url ?? null}, youtube_url)
        WHERE user_id = ${req.user.id}
        RETURNING *
      `;
    } else {
      profile = await sql`
        INSERT INTO cook_profiles (
          user_id, display_name, username, pronouns,
          location, lga, latitude, longitude, bio,
          bank_name, bank_code, bank_account_number, bank_account_name,
          instagram_handle, tiktok_handle, youtube_url, twitter_handle,
          kitchen_photos, profile_video_url, verification_status
        ) VALUES (
          ${req.user.id}, ${display_name}, ${username}, ${pronouns ?? 'she_her'},
          ${location ?? null}, ${lga ?? null},
          ${latitude ?? null}, ${longitude ?? null}, ${bio ?? null},
          ${bank_name ?? null}, ${bank_code ?? null}, ${bank_account_number ?? null}, ${bank_account_name ?? null},
          ${instagram_handle ?? null}, ${tiktok_handle ?? null}, ${youtube_url ?? null}, ${twitter_handle ?? null},
          ${kitchen_photos ?? []}::text[], ${profile_video_url ?? null},
          'pending'
        )
        RETURNING *
      `;
    }

    await sql`UPDATE users SET role = 'cook', full_name = ${display_name} WHERE id = ${req.user.id}`;
    res.status(200).json({ cook: profile[0] });
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

    if (is_live) {
      // Auto-create a LIVE story (expires in 24h like all stories)
      const [story] = await sql`
        INSERT INTO stories (cook_id, type)
        VALUES (${id}, 'live')
        RETURNING id
      `;

      // Notify followers who have notify_live = true
      const followers = await sql`
        SELECT f.customer_id, pt.token
        FROM follows f
        JOIN push_tokens pt ON pt.user_id = f.customer_id
        WHERE f.cook_id = ${id} AND f.notify_live = true
      `;

      if (followers.length > 0) {
        const [cookInfo] = await sql`SELECT display_name FROM cook_profiles WHERE id = ${id}`;
        const cookName = cookInfo?.display_name ?? 'A cook';

        // In-app notifications
        for (const f of followers) {
          await sql`
            INSERT INTO notifications (user_id, type, title, body, data)
            VALUES (
              ${f.customer_id}, 'cook_live',
              ${cookName + ' is cooking LIVE!'},
              ${'Tap to watch and order in real-time'},
              ${{ cook_id: id, story_id: story.id }}::jsonb
            )
          `;
        }

        // Push notifications (fire-and-forget)
        const tokens = followers.map(f => f.token).filter(Boolean);
        sendPushNotifications(tokens, {
          title: `${cookName} is cooking LIVE! 🔴`,
          body: 'Tap to watch and order in real-time',
          data: { type: 'cook_live', cook_id: id },
        });
      }
    }

    res.json({ is_live: !!is_live });
  } catch (err) {
    console.error('PATCH /cooks/:id/live:', err);
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

// ── GET /api/cooks/me/archive ────────────────────────────────────────────────
// Cook's full meal archive — every dish ever created with stats
router.get('/me/archive', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const { limit = 50, offset = 0 } = req.query;

    const items = await sql`
      SELECT
        mi.id, mi.title, mi.photos, mi.unit_price, mi.currency_code,
        mi.dietary_labels, mi.allergens, mi.is_active,
        mi.available_date, mi.created_at,
        mi.slots_claimed AS orders_count,
        COALESCE((
          SELECT COUNT(*) FROM cravings c WHERE c.menu_item_id = mi.id
        ), 0)::int AS craving_count,
        COALESCE((
          SELECT COUNT(*) FROM reviews r
          JOIN orders o ON o.id = r.order_id
          WHERE o.menu_item_id = mi.id
        ), 0)::int AS review_count,
        COALESCE((
          SELECT ROUND(AVG(r.rating)::numeric, 1) FROM reviews r
          JOIN orders o ON o.id = r.order_id
          WHERE o.menu_item_id = mi.id
        ), 0)::numeric AS avg_rating,
        COALESCE((
          SELECT SUM(o.cook_payout) FROM orders o
          WHERE o.menu_item_id = mi.id AND o.status NOT IN ('cancelled','refunded','pending_payment')
        ), 0)::numeric AS revenue
      FROM menu_items mi
      WHERE mi.cook_id = ${cookId}
      ORDER BY mi.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    res.json({ items });
  } catch (err) {
    console.error('GET /cooks/me/archive:', err);
    res.status(500).json({ error: 'Failed to fetch archive' });
  }
});

// ── PATCH /api/cooks/me/health-specialisations ───────────────────────────────
router.patch('/me/health-specialisations', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const { specialisations } = req.body;
    if (!Array.isArray(specialisations)) {
      return res.status(400).json({ error: 'specialisations must be an array' });
    }

    const VALID = [
      'keto','vegan','vegetarian','halal','low_carb','diabetic_friendly',
      'gluten_free','high_protein','dairy_free','low_sodium','heart_healthy','pregnancy',
    ];
    const filtered = specialisations.filter(s => VALID.includes(s));

    await sql`DELETE FROM cook_health_specialisations WHERE cook_id = ${cookId}`;
    if (filtered.length > 0) {
      for (const s of filtered) {
        await sql`
          INSERT INTO cook_health_specialisations (cook_id, specialisation)
          VALUES (${cookId}, ${s})
          ON CONFLICT DO NOTHING
        `;
      }
    }

    const isHealth = filtered.length > 0;
    await sql`UPDATE cook_profiles SET is_health_kitchen = ${isHealth} WHERE id = ${cookId}`;

    res.json({ specialisations: filtered, is_health_kitchen: isHealth });
  } catch (err) {
    console.error('PATCH /cooks/me/health-specialisations:', err);
    res.status(500).json({ error: 'Failed to update health specialisations' });
  }
});

// ── PATCH /api/cooks/me/kitchen-photos ──────────────────────────────────────
router.patch('/me/kitchen-photos', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { kitchen_photos, profile_video_url, banner_image_url } = req.body;

    const updated = await sql`
      UPDATE cook_profiles SET
        kitchen_photos    = COALESCE(${kitchen_photos ?? null}::text[], kitchen_photos),
        profile_video_url = COALESCE(${profile_video_url ?? null},       profile_video_url),
        banner_image_url  = COALESCE(${banner_image_url ?? null},        banner_image_url)
      WHERE id = ${cooks[0].id}
      RETURNING kitchen_photos, profile_video_url, banner_image_url
    `;
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update kitchen media' });
  }
});

// ── GET /api/cooks/customer-lookup?phone=xxx ─────────────────────────────────
// Lets a cook look up a registered customer by phone to invoice/quote them.
router.get('/customer-lookup', authenticate, async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  const normalised = String(phone).replace(/\D/g, '');
  const rows = await sql`
    SELECT id, full_name, phone FROM users
    WHERE REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = ${normalised}
       OR phone = ${phone}
    LIMIT 1
  `;
  if (!rows.length) return res.status(404).json({ error: 'No user found with that phone number' });
  res.json({ user: { id: rows[0].id, name: rows[0].full_name, phone: rows[0].phone } });
});

module.exports = router;
