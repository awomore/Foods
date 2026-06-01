const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/subscriptions/tiers/:cookId — public tiers ──────────────────────
router.get('/tiers/:cookId', async (req, res) => {
  try {
    const tiers = await sql`
      SELECT * FROM creator_subscription_tiers
      WHERE cook_id = ${req.params.cookId} AND is_active = true
      ORDER BY price ASC
    `;
    res.json({ tiers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tiers' });
  }
});

// ── POST /api/subscriptions/tiers — cook creates a tier ──────────────────────
router.post('/tiers', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { name, price, billing_period, benefits } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'name and price required' });

    const [tier] = await sql`
      INSERT INTO creator_subscription_tiers (cook_id, name, price, billing_period, benefits)
      VALUES (
        ${cooks[0].id}, ${name}, ${price},
        ${billing_period ?? 'monthly'},
        ${JSON.stringify(benefits ?? [])}::text[]
      ) RETURNING *
    `;
    res.status(201).json({ tier });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create tier' });
  }
});

// ── PATCH /api/subscriptions/tiers/:id ───────────────────────────────────────
router.patch('/tiers/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const f = req.body;
    const [tier] = await sql`
      UPDATE creator_subscription_tiers SET
        name           = COALESCE(${f.name ?? null}, name),
        price          = COALESCE(${f.price ?? null}, price),
        billing_period = COALESCE(${f.billing_period ?? null}, billing_period),
        benefits       = COALESCE(${f.benefits ? JSON.stringify(f.benefits) + '::text[]' : null}::text[], benefits),
        is_active      = COALESCE(${f.is_active ?? null}, is_active)
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!tier) return res.status(404).json({ error: 'Tier not found' });
    res.json({ tier });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tier' });
  }
});

// ── POST /api/subscriptions/subscribe — customer subscribes ──────────────────
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { tier_id, tx_ref, amount_paid } = req.body;
    if (!tier_id) return res.status(400).json({ error: 'tier_id required' });

    const tiers = await sql`SELECT * FROM creator_subscription_tiers WHERE id = ${tier_id} AND is_active = true`;
    if (!tiers.length) return res.status(404).json({ error: 'Tier not found' });
    const tier = tiers[0];

    // Calculate expiry
    const periods = { monthly: 30, quarterly: 90, yearly: 365 };
    const days = periods[tier.billing_period] ?? 30;

    const [sub] = await sql`
      INSERT INTO creator_subscriptions (
        tier_id, subscriber_id, cook_id, tx_ref, amount_paid,
        expires_at
      ) VALUES (
        ${tier_id}, ${req.user.id}, ${tier.cook_id},
        ${tx_ref ?? null}, ${amount_paid ?? tier.price},
        NOW() + INTERVAL '1 day' * ${days}
      )
      ON CONFLICT (tier_id, subscriber_id) DO UPDATE SET
        status     = 'active',
        tx_ref     = EXCLUDED.tx_ref,
        started_at = NOW(),
        expires_at = NOW() + INTERVAL '1 day' * ${days}
      RETURNING *
    `;
    res.status(201).json({ subscription: sub });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ── GET /api/subscriptions/my — caller's active subscriptions ─────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const subs = await sql`
      SELECT cs.*, cst.name AS tier_name, cst.benefits, cst.price AS tier_price,
             cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
      FROM creator_subscriptions cs
      JOIN creator_subscription_tiers cst ON cst.id = cs.tier_id
      JOIN cook_profiles cp ON cp.id = cs.cook_id
      WHERE cs.subscriber_id = ${req.user.id} AND cs.status = 'active'
      ORDER BY cs.started_at DESC
    `;
    res.json({ subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// ── DELETE /api/subscriptions/:id/cancel ─────────────────────────────────────
router.delete('/:id/cancel', authenticate, async (req, res) => {
  try {
    const [updated] = await sql`
      UPDATE creator_subscriptions SET status = 'cancelled'
      WHERE id = ${req.params.id} AND subscriber_id = ${req.user.id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

module.exports = router;
