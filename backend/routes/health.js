const express  = require('express');
const router   = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { sql }  = require('../supabase/db');

const VALID_SPECIALISATIONS = [
  'diabetes','weight_loss','heart_health','pregnancy','postpartum',
  'child_nutrition','keto','low_sodium','high_protein','gut_health',
  'anti_inflammatory','general_wellness','vegan','vegetarian',
  'gluten_free','dairy_free','halal','low_carb',
];

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER HEALTH PROFILE
// ─────────────────────────────────────────────────────────────────────────────

router.get('/customer/profile', authenticate, async (req, res) => {
  try {
    const customers = await sql`SELECT id FROM customer_profiles WHERE user_id = ${req.user.id}`;
    if (!customers.length) return res.json({ health_profile: null });
    const profile = await sql`SELECT * FROM customer_health_profiles WHERE customer_id = ${customers[0].id}`;
    res.json({ health_profile: profile[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health profile' });
  }
});

router.patch('/customer/profile', authenticate, async (req, res) => {
  try {
    const customers = await sql`
      INSERT INTO customer_profiles (user_id)
      VALUES (${req.user.id})
      ON CONFLICT (user_id) DO UPDATE SET user_id = ${req.user.id}
      RETURNING id
    `;
    const customerId = customers[0].id;
    const { allergens, dietary_preferences, conditions, health_goals, health_notes, is_visible_to_cooks } = req.body;

    const profile = await sql`
      INSERT INTO customer_health_profiles
        (customer_id, allergens, dietary_preferences, conditions, health_goals, health_notes, is_visible_to_cooks)
      VALUES (
        ${customerId},
        ${allergens ?? []}::text[],
        ${dietary_preferences ?? []}::text[],
        ${conditions ?? []}::text[],
        ${health_goals ?? []}::text[],
        ${health_notes ?? null},
        ${is_visible_to_cooks ?? false}
      )
      ON CONFLICT (customer_id) DO UPDATE SET
        allergens           = COALESCE(${allergens          ?? null}::text[], customer_health_profiles.allergens),
        dietary_preferences = COALESCE(${dietary_preferences ?? null}::text[], customer_health_profiles.dietary_preferences),
        conditions          = COALESCE(${conditions         ?? null}::text[], customer_health_profiles.conditions),
        health_goals        = COALESCE(${health_goals       ?? null}::text[], customer_health_profiles.health_goals),
        health_notes        = COALESCE(${health_notes       ?? null},         customer_health_profiles.health_notes),
        is_visible_to_cooks = COALESCE(${is_visible_to_cooks ?? null},        customer_health_profiles.is_visible_to_cooks),
        updated_at          = NOW()
      RETURNING *
    `;
    res.json({ health_profile: profile[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update health profile' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH KITCHEN DISCOVERY
// ─────────────────────────────────────────────────────────────────────────────

router.get('/kitchens', async (req, res) => {
  try {
    const { specialisation, lat, lng, limit = 20 } = req.query;
    const hasGeo = !!(lat && lng);
    const latN   = hasGeo ? parseFloat(lat) : null;
    const lngN   = hasGeo ? parseFloat(lng) : null;

    const kitchens = await sql`
      SELECT
        cp.id, cp.display_name, u.avatar_url, cp.location, cp.average_rating,
        cp.total_orders, cp.is_live, cp.is_health_kitchen,
        cp.health_credential_type, cp.health_credential_verified,
        u.full_name,
        ${hasGeo ? sql`
          ROUND((6371 * acos(
            cos(radians(${latN})) * cos(radians(cp.latitude))
            * cos(radians(cp.longitude) - radians(${lngN}))
            + sin(radians(${latN})) * sin(radians(cp.latitude))
          ))::numeric, 1)` : sql`0::numeric`} AS distance_km,
        ARRAY(
          SELECT specialisation FROM cook_health_specialisations WHERE cook_id = cp.id
        ) AS specialisations,
        (SELECT COUNT(*) FROM health_meal_plans WHERE creator_id = cp.id AND is_published = true) AS plan_count
      FROM cook_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.is_health_kitchen = true
        AND cp.verification_status = 'approved'
        AND (${specialisation ?? null}::text IS NULL OR EXISTS (
          SELECT 1 FROM cook_health_specialisations
          WHERE cook_id = cp.id AND specialisation = ${specialisation ?? null}
        ))
      ORDER BY cp.average_rating DESC, cp.total_orders DESC
      LIMIT ${Math.min(parseInt(limit), 100)}
    `;
    res.json({ kitchens });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health kitchens' });
  }
});

// Subscribe to a health kitchen creator (grants consent too)
router.post('/kitchens/:cookId/subscribe', authenticate, async (req, res) => {
  try {
    const customers = await sql`
      INSERT INTO customer_profiles (user_id) VALUES (${req.user.id})
      ON CONFLICT (user_id) DO UPDATE SET user_id = ${req.user.id}
      RETURNING id
    `;
    const customerId = customers[0].id;

    const [sub] = await sql`
      INSERT INTO health_subscriptions (customer_id, cook_id)
      VALUES (${customerId}, ${req.params.cookId})
      ON CONFLICT (customer_id, cook_id) DO UPDATE SET status = 'active'
      RETURNING *
    `;

    // Auto-grant feeding history consent on subscribe
    await sql`
      INSERT INTO health_data_consent (user_id, creator_id)
      VALUES (${req.user.id}, ${req.params.cookId})
      ON CONFLICT (user_id, creator_id) DO UPDATE SET is_active = true, revoked_at = null
    `;

    res.status(201).json({ subscription: sub });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH MEAL PLANS — CREATOR SIDE
// ─────────────────────────────────────────────────────────────────────────────

// List this creator's plans
router.get('/plans/mine', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const plans = await sql`
      SELECT * FROM health_meal_plans WHERE creator_id = ${cooks[0].id}
      ORDER BY created_at DESC
    `;
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create a plan
router.post('/plans', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id, is_health_kitchen FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    if (!cooks[0].is_health_kitchen) return res.status(403).json({ error: 'Health Kitchen status required' });

    const { title, description, target_condition, duration_weeks, meals_per_day, price } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const [plan] = await sql`
      INSERT INTO health_meal_plans
        (creator_id, title, description, target_condition, duration_weeks, meals_per_day, price)
      VALUES (
        ${cooks[0].id}, ${title}, ${description ?? null},
        ${target_condition ?? null}, ${duration_weeks ?? 4},
        ${meals_per_day ?? 3}, ${price ?? 0}
      )
      RETURNING *
    `;
    res.status(201).json({ plan });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// Get a plan with its items
router.get('/plans/:id', optionalAuth, async (req, res) => {
  try {
    const plans = await sql`
      SELECT hmp.*, cp.display_name AS creator_name, u.avatar_url AS creator_avatar,
             cp.health_credential_type, cp.health_credential_verified
      FROM health_meal_plans hmp
      JOIN cook_profiles cp ON cp.id = hmp.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE hmp.id = ${req.params.id}
    `;
    if (!plans.length) return res.status(404).json({ error: 'Plan not found' });
    const plan = plans[0];

    // Only creator or subscribers can see unpublished plans
    if (!plan.is_published) {
      if (!req.user) return res.status(403).json({ error: 'Access denied' });
      const isMine = req.user.role === 'cook' &&
        (await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} AND id = ${plan.creator_id}`).length > 0;
      if (!isMine && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
    }

    const items = await sql`
      SELECT * FROM health_meal_plan_items
      WHERE plan_id = ${plan.id}
      ORDER BY week_number, day_number,
        CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 ELSE 4 END
    `;

    res.json({ plan, items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plan' });
  }
});

// Update plan metadata
router.patch('/plans/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const [plan] = await sql`SELECT id, creator_id FROM health_meal_plans WHERE id = ${req.params.id}`;
    if (!plan || plan.creator_id !== cooks[0].id) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, target_condition, duration_weeks, meals_per_day, price, is_published } = req.body;
    const [updated] = await sql`
      UPDATE health_meal_plans SET
        title            = COALESCE(${title            ?? null}, title),
        description      = COALESCE(${description      ?? null}, description),
        target_condition = COALESCE(${target_condition ?? null}, target_condition),
        duration_weeks   = COALESCE(${duration_weeks   ?? null}, duration_weeks),
        meals_per_day    = COALESCE(${meals_per_day    ?? null}, meals_per_day),
        price            = COALESCE(${price            ?? null}, price),
        is_published     = COALESCE(${is_published     ?? null}, is_published),
        updated_at       = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ plan: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ── Plan items ────────────────────────────────────────────────────────────────

router.post('/plans/:id/items', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const plans = await sql`SELECT id FROM health_meal_plans WHERE id = ${req.params.id} AND creator_id = ${cooks[0].id}`;
    if (!plans.length) return res.status(403).json({ error: 'Forbidden' });

    const { week_number, day_number, meal_type, title, description, calories, protein_g, carbs_g, fat_g, linked_menu_item_id } = req.body;
    if (!day_number || !meal_type || !title) return res.status(400).json({ error: 'day_number, meal_type, title required' });

    const [item] = await sql`
      INSERT INTO health_meal_plan_items
        (plan_id, week_number, day_number, meal_type, title, description, calories, protein_g, carbs_g, fat_g, linked_menu_item_id)
      VALUES (
        ${req.params.id}, ${week_number ?? 1}, ${day_number}, ${meal_type}, ${title},
        ${description ?? null}, ${calories ?? null}, ${protein_g ?? null},
        ${carbs_g ?? null}, ${fat_g ?? null}, ${linked_menu_item_id ?? null}
      )
      RETURNING *
    `;
    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add plan item' });
  }
});

router.patch('/plans/:planId/items/:itemId', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const plans = await sql`SELECT id FROM health_meal_plans WHERE id = ${req.params.planId} AND creator_id = ${cooks[0].id}`;
    if (!plans.length) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, calories, protein_g, carbs_g, fat_g } = req.body;
    const [item] = await sql`
      UPDATE health_meal_plan_items SET
        title       = COALESCE(${title       ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        calories    = COALESCE(${calories    ?? null}, calories),
        protein_g   = COALESCE(${protein_g   ?? null}, protein_g),
        carbs_g     = COALESCE(${carbs_g     ?? null}, carbs_g),
        fat_g       = COALESCE(${fat_g       ?? null}, fat_g)
      WHERE id = ${req.params.itemId} AND plan_id = ${req.params.planId}
      RETURNING *
    `;
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/plans/:planId/items/:itemId', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const plans = await sql`SELECT id FROM health_meal_plans WHERE id = ${req.params.planId} AND creator_id = ${cooks[0].id}`;
    if (!plans.length) return res.status(403).json({ error: 'Forbidden' });

    await sql`DELETE FROM health_meal_plan_items WHERE id = ${req.params.itemId} AND plan_id = ${req.params.planId}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLAN SUBSCRIPTIONS — CUSTOMER SIDE
// ─────────────────────────────────────────────────────────────────────────────

// Browse published plans
router.get('/plans', optionalAuth, async (req, res) => {
  try {
    const { condition, limit = 20, offset = 0 } = req.query;
    const plans = await sql`
      SELECT hmp.*,
             cp.display_name AS creator_name, u.avatar_url AS creator_avatar,
             cp.health_credential_type, cp.health_credential_verified,
             ARRAY(
               SELECT DISTINCT specialisation FROM cook_health_specialisations WHERE cook_id = cp.id
             ) AS specialisations
      FROM health_meal_plans hmp
      JOIN cook_profiles cp ON cp.id = hmp.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE hmp.is_published = true
        AND (${condition ?? null}::text IS NULL OR hmp.target_condition = ${condition ?? null})
      ORDER BY hmp.subscriber_count DESC, hmp.created_at DESC
      LIMIT ${Math.min(parseInt(limit), 100)} OFFSET ${parseInt(offset)}
    `;
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Subscribe to a plan
router.post('/plans/:id/subscribe', authenticate, async (req, res) => {
  try {
    const plans = await sql`SELECT id, creator_id, price, duration_weeks FROM health_meal_plans WHERE id = ${req.params.id} AND is_published = true`;
    if (!plans.length) return res.status(404).json({ error: 'Plan not found' });
    const plan = plans[0];

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.duration_weeks * 7);

    const [sub] = await sql`
      INSERT INTO health_plan_subscriptions (user_id, plan_id, creator_id, expires_at)
      VALUES (${req.user.id}, ${plan.id}, ${plan.creator_id}, ${expiresAt.toISOString()})
      ON CONFLICT (user_id, plan_id) DO UPDATE SET status = 'active', expires_at = ${expiresAt.toISOString()}
      RETURNING *
    `;

    // Auto-grant consent to creator
    await sql`
      INSERT INTO health_data_consent (user_id, creator_id)
      VALUES (${req.user.id}, ${plan.creator_id})
      ON CONFLICT (user_id, creator_id) DO UPDATE SET is_active = true, revoked_at = null
    `;

    await sql`
      UPDATE health_meal_plans SET subscriber_count = subscriber_count + 1 WHERE id = ${plan.id}
    `;

    res.status(201).json({ subscription: sub });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe to plan' });
  }
});

// Customer's active plan subscriptions
router.get('/my-plans', authenticate, async (req, res) => {
  try {
    const subs = await sql`
      SELECT hps.*,
             hmp.title, hmp.description, hmp.target_condition,
             hmp.duration_weeks, hmp.meals_per_day, hmp.price,
             cp.display_name AS creator_name, u.avatar_url AS creator_avatar
      FROM health_plan_subscriptions hps
      JOIN health_meal_plans hmp ON hmp.id = hps.plan_id
      JOIN cook_profiles cp ON cp.id = hps.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE hps.user_id = ${req.user.id} AND hps.status = 'active'
      ORDER BY hps.started_at DESC
    `;
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Cancel a plan subscription
router.patch('/my-plans/:id/cancel', authenticate, async (req, res) => {
  try {
    const [sub] = await sql`
      UPDATE health_plan_subscriptions
      SET status = 'cancelled', cancelled_at = NOW()
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING *
    `;
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: sub });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIBERS — CREATOR SIDE (who has consent)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/subscribers', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id, is_health_kitchen FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length || !cooks[0].is_health_kitchen) return res.status(403).json({ error: 'Health Kitchen required' });

    const subscribers = await sql`
      SELECT
        hdc.user_id, hdc.granted_at, hdc.is_active,
        u.full_name, u.avatar_url,
        chp.health_goals, chp.conditions, chp.allergens, chp.dietary_preferences,
        (SELECT COUNT(*) FROM health_plan_subscriptions hps
         WHERE hps.user_id = hdc.user_id AND hps.creator_id = ${cooks[0].id} AND hps.status = 'active') AS active_plan_count,
        (SELECT title FROM health_meal_plans hmp
         JOIN health_plan_subscriptions hps2 ON hps2.plan_id = hmp.id
         WHERE hps2.user_id = hdc.user_id AND hps2.creator_id = ${cooks[0].id}
           AND hps2.status = 'active'
         ORDER BY hps2.started_at DESC LIMIT 1) AS active_plan_title
      FROM health_data_consent hdc
      JOIN users u ON u.id = hdc.user_id
      LEFT JOIN customer_profiles cp2 ON cp2.user_id = hdc.user_id
      LEFT JOIN customer_health_profiles chp ON chp.customer_id = cp2.id
      WHERE hdc.creator_id = ${cooks[0].id} AND hdc.is_active = true
      ORDER BY hdc.granted_at DESC
    `;
    res.json({ subscribers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FEEDING HISTORY — health kitchen creators only, requires consent
// ─────────────────────────────────────────────────────────────────────────────

router.get('/feeding-history/:userId', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id, is_health_kitchen FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length || !cooks[0].is_health_kitchen) return res.status(403).json({ error: 'Health Kitchen required' });

    // Check active consent
    const consent = await sql`
      SELECT id FROM health_data_consent
      WHERE user_id = ${req.params.userId} AND creator_id = ${cooks[0].id} AND is_active = true
    `;
    if (!consent.length) return res.status(403).json({ error: 'User has not granted feeding history access' });

    // Order history — last 90 days
    const orders = await sql`
      SELECT o.id, o.created_at, mi.title AS item_title, o.quantity, o.total_amount AS total_price, o.status,
             o.order_type, mi.calories, mi.protein_g, mi.carbs_g, mi.fat_g,
             mi.dietary_labels AS dietary_tags
      FROM orders o
      LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
      WHERE o.customer_id = ${req.params.userId}
        AND o.status IN ('delivered','completed')
        AND o.created_at >= NOW() - INTERVAL '90 days'
      ORDER BY o.created_at DESC
      LIMIT 200
    `;

    // Aggregate per day for charts
    const dailySummary = await sql`
      SELECT
        DATE(o.created_at)::text AS date,
        COUNT(*)::int            AS order_count,
        SUM(o.total_amount)      AS total_spend,
        SUM(COALESCE(mi.calories, 0))::int AS total_calories
      FROM orders o
      LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
      WHERE o.customer_id = ${req.params.userId}
        AND o.status IN ('delivered','completed')
        AND o.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC
    `;

    // User health profile for context
    const healthProfile = await sql`
      SELECT chp.health_goals, chp.conditions, chp.allergens, chp.dietary_preferences, chp.health_notes
      FROM customer_health_profiles chp
      JOIN customer_profiles cp ON cp.id = chp.customer_id
      WHERE cp.user_id = ${req.params.userId}
    `;

    res.json({
      orders,
      daily_summary: dailySummary,
      health_profile: healthProfile[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feeding history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSENT MANAGEMENT — customer controls
// ─────────────────────────────────────────────────────────────────────────────

// List which creators have consent
router.get('/consent', authenticate, async (req, res) => {
  try {
    const consents = await sql`
      SELECT hdc.*, cp.display_name AS creator_name, u.avatar_url AS creator_avatar
      FROM health_data_consent hdc
      JOIN cook_profiles cp ON cp.id = hdc.creator_id
      JOIN users u ON u.id = cp.user_id
      WHERE hdc.user_id = ${req.user.id}
      ORDER BY hdc.granted_at DESC
    `;
    res.json({ consents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch consent records' });
  }
});

// Revoke consent for a creator
router.patch('/consent/:creatorId/revoke', authenticate, async (req, res) => {
  try {
    const [consent] = await sql`
      UPDATE health_data_consent
      SET is_active = false, revoked_at = NOW()
      WHERE user_id = ${req.user.id} AND creator_id = ${req.params.creatorId}
      RETURNING *
    `;
    if (!consent) return res.status(404).json({ error: 'Consent record not found' });
    res.json({ consent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke consent' });
  }
});

module.exports = router;
