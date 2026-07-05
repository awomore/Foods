const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { toMinor } = require('../payments/money');
const crypto = require('crypto');

function generateGiftCode() {
  return 'FBM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateShareLink() {
  return 'gift-' + crypto.randomBytes(6).toString('hex');
}

// ── POST /api/gifting/gift-cards ─────────────────────────────────────────────
router.post('/gift-cards', authenticate, async (req, res) => {
  try {
    const { denomination, recipient_phone, recipient_email, gift_message, delivery_method } = req.body;
    if (!denomination) return res.status(400).json({ error: 'denomination required' });

    const code = generateGiftCode();
    const expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    const card = await sql`
      INSERT INTO gift_cards (
        code, denomination, balance, purchased_by,
        recipient_phone, recipient_email, gift_message, delivery_method, expires_at
      ) VALUES (
        ${code}, ${denomination}, ${denomination}, ${req.user.id},
        ${recipient_phone ?? null}, ${recipient_email ?? null},
        ${gift_message ?? null}, ${delivery_method ?? 'whatsapp'},
        ${expires_at.toISOString()}::timestamptz
      )
      RETURNING *
    `;

    res.status(201).json({ gift_card: card[0] });
  } catch (err) {
    console.error('POST /gifting/gift-cards:', err);
    res.status(500).json({ error: 'Failed to create gift card' });
  }
});

// ── GET /api/gifting/gift-cards/:code ────────────────────────────────────────
router.get('/gift-cards/:code', authenticate, async (req, res) => {
  try {
    const cards = await sql`
      SELECT * FROM gift_cards WHERE code = ${req.params.code}
    `;
    if (!cards.length) return res.status(404).json({ error: 'Gift card not found' });
    const card = cards[0];
    if (card.expires_at < new Date()) return res.status(400).json({ error: 'Gift card expired' });
    if (card.is_redeemed) return res.status(400).json({ error: 'Gift card already redeemed' });
    res.json({ gift_card: card });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gift card' });
  }
});

// ── POST /api/gifting/gift-cards/:code/redeem ────────────────────────────────
router.post('/gift-cards/:code/redeem', authenticate, async (req, res) => {
  try {
    const cards = await sql`
      SELECT * FROM gift_cards WHERE code = ${req.params.code} FOR UPDATE
    `;
    if (!cards.length) return res.status(404).json({ error: 'Gift card not found' });
    const card = cards[0];
    if (card.is_redeemed) return res.status(400).json({ error: 'Already redeemed' });
    if (card.expires_at < new Date()) return res.status(400).json({ error: 'Gift card expired' });

    await sql`
      UPDATE gift_cards
      SET is_redeemed = true, redeemed_by = ${req.user.id}, balance = 0
      WHERE code = ${req.params.code}
    `;

    const credits = Math.floor(card.denomination);
    const creditsMinor = toMinor(credits);

    // Credit wallet balance (dual-write: legacy `_ngn` + new `_minor` columns)
    await sql`
      INSERT INTO wallet_balances (customer_id, balance_ngn, balance_minor)
      VALUES (${req.user.id}, ${credits}, ${creditsMinor})
      ON CONFLICT (customer_id) DO UPDATE
      SET balance_ngn   = wallet_balances.balance_ngn + ${credits},
          balance_minor = wallet_balances.balance_minor + ${creditsMinor},
          updated_at    = NOW()
    `;
    await sql`
      INSERT INTO wallet_transactions (customer_id, type, amount_ngn, amount_minor, description, ref)
      VALUES (${req.user.id}, 'gift_redeem', ${credits}, ${creditsMinor}, ${'Gift card redeemed: ' + card.code}, ${card.code})
    `;

    // Also credit loyalty points for backwards compatibility
    await sql`
      INSERT INTO loyalty_points (customer_id, balance, lifetime_earned)
      VALUES (${req.user.id}, ${credits}, ${credits})
      ON CONFLICT (customer_id) DO UPDATE
      SET balance = loyalty_points.balance + ${credits},
          lifetime_earned = loyalty_points.lifetime_earned + ${credits}
    `;

    res.json({ gift_card: { ...card, is_redeemed: true }, credits_added: credits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to redeem gift card' });
  }
});

// ── POST /api/gifting/group-gifts ────────────────────────────────────────────
router.post('/group-gifts', authenticate, async (req, res) => {
  try {
    const { recipient_name, recipient_phone, recipient_address, menu_item_id, cook_id, target_amount, message } = req.body;
    if (!recipient_name || !recipient_phone || !target_amount) {
      return res.status(400).json({ error: 'recipient_name, recipient_phone, and target_amount required' });
    }

    const share_link = generateShareLink();
    const expires_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    const gift = await sql`
      INSERT INTO group_gifts (
        initiator_id, recipient_name, recipient_phone, recipient_address,
        menu_item_id, cook_id, target_amount, message, share_link, expires_at
      ) VALUES (
        ${req.user.id}, ${recipient_name}, ${recipient_phone}, ${recipient_address ?? null},
        ${menu_item_id ?? null}, ${cook_id ?? null}, ${target_amount},
        ${message ?? null}, ${share_link}, ${expires_at.toISOString()}::timestamptz
      )
      RETURNING *
    `;

    res.status(201).json({ group_gift: gift[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group gift' });
  }
});

// ── GET /api/gifting/group-gifts/:id ─────────────────────────────────────────
router.get('/group-gifts/:id', async (req, res) => {
  try {
    const gifts = await sql`
      SELECT gg.*, mi.title AS item_title, mi.photos AS item_photos,
             cp.display_name AS cook_name
      FROM group_gifts gg
      LEFT JOIN menu_items mi ON mi.id = gg.menu_item_id
      LEFT JOIN cook_profiles cp ON cp.id = gg.cook_id
      WHERE gg.id = ${req.params.id} OR gg.share_link = ${req.params.id}
    `;
    if (!gifts.length) return res.status(404).json({ error: 'Group gift not found' });

    const contributors = await sql`
      SELECT ggc.*, u.full_name AS contributor_display_name
      FROM group_gift_contributions ggc
      LEFT JOIN users u ON u.id = ggc.contributor_id
      WHERE ggc.group_gift_id = ${gifts[0].id}
      ORDER BY ggc.created_at ASC
    `;

    res.json({ group_gift: gifts[0], contributors });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group gift' });
  }
});

// ── POST /api/gifting/group-gifts/:id/contribute ─────────────────────────────
router.post('/group-gifts/:id/contribute', authenticate, async (req, res) => {
  try {
    const { amount, contributor_name } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Positive amount required' });

    const gifts = await sql`SELECT * FROM group_gifts WHERE id = ${req.params.id} FOR UPDATE`;
    if (!gifts.length) return res.status(404).json({ error: 'Group gift not found' });
    const gift = gifts[0];
    if (gift.status !== 'open') return res.status(400).json({ error: 'Group gift is closed' });

    const contrib = await sql`
      INSERT INTO group_gift_contributions (group_gift_id, contributor_id, contributor_name, amount)
      VALUES (${gift.id}, ${req.user.id}, ${contributor_name ?? null}, ${amount})
      RETURNING *
    `;

    const newAmount = parseFloat(gift.current_amount) + parseFloat(amount);
    const isFunded = newAmount >= parseFloat(gift.target_amount);

    await sql`
      UPDATE group_gifts
      SET current_amount = ${newAmount}, status = ${isFunded ? 'funded' : 'open'}
      WHERE id = ${gift.id}
    `;

    res.status(201).json({ contribution: contrib[0], is_funded: isFunded, current_amount: newAmount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add contribution' });
  }
});

// ── POST /api/gifting/subscriptions ──────────────────────────────────────────
router.post('/subscriptions', authenticate, async (req, res) => {
  try {
    const {
      plan_id, sub_type, meal_slots, add_dietician,
      recipient_name, recipient_phone, recipient_address,
      preferences, total_amount, currency_code,
    } = req.body;

    if (!plan_id || !sub_type || !recipient_name || !recipient_phone || !recipient_address) {
      return res.status(400).json({ error: 'plan_id, sub_type, recipient_name, recipient_phone, and recipient_address are required' });
    }

    const slots = Array.isArray(meal_slots) ? meal_slots : (meal_slots ? [meal_slots] : []);

    const rows = await sql`
      INSERT INTO meal_subscriptions (
        gifter_id, plan_id, sub_type, meal_slots, add_dietician,
        recipient_name, recipient_phone, recipient_address,
        preferences, total_amount, currency_code
      ) VALUES (
        ${req.user.id}, ${plan_id}, ${sub_type}, ${slots}, ${!!add_dietician},
        ${recipient_name}, ${recipient_phone}, ${recipient_address},
        ${preferences ?? null}, ${total_amount ?? null}, ${currency_code ?? 'NGN'}
      )
      RETURNING *
    `;
    res.status(201).json({ subscription: rows[0] });
  } catch (err) {
    console.error('POST /gifting/subscriptions:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// ── GET /api/gifting/subscriptions ───────────────────────────────────────────
router.get('/subscriptions', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM meal_subscriptions
      WHERE gifter_id = ${req.user.id}
      ORDER BY created_at DESC
    `;
    res.json({ subscriptions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// ── PATCH /api/gifting/subscriptions/:id/pause ───────────────────────────────
router.patch('/subscriptions/:id/pause', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      UPDATE meal_subscriptions SET status = 'paused'
      WHERE id = ${req.params.id} AND gifter_id = ${req.user.id}
      RETURNING *
    `;
    if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pause subscription' });
  }
});

// ── PATCH /api/gifting/subscriptions/:id/cancel ──────────────────────────────
router.patch('/subscriptions/:id/cancel', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      UPDATE meal_subscriptions SET status = 'cancelled'
      WHERE id = ${req.params.id} AND gifter_id = ${req.user.id}
      RETURNING *
    `;
    if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ── GET /api/gifting/subscriptions/:id/meals ─────────────────────────────────
router.get('/subscriptions/:id/meals', authenticate, async (req, res) => {
  try {
    const subs = await sql`
      SELECT * FROM meal_subscriptions
      WHERE id = ${req.params.id} AND gifter_id = ${req.user.id}
    `;
    if (!subs.length) return res.status(404).json({ error: 'Subscription not found' });

    const meals = await sql`
      SELECT * FROM subscription_meals
      WHERE subscription_id = ${req.params.id}
      ORDER BY delivery_date ASC, meal_slot ASC
    `;
    res.json({ subscription: subs[0], meals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch meal schedule' });
  }
});

// ── POST /api/gifting/subscriptions/:id/meals/:meal_id/feedback ──────────────
router.post('/subscriptions/:id/meals/:meal_id/feedback', authenticate, async (req, res) => {
  try {
    const { action, reason, feedback } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }

    const subs = await sql`
      SELECT * FROM meal_subscriptions
      WHERE id = ${req.params.id} AND gifter_id = ${req.user.id}
    `;
    if (!subs.length) return res.status(403).json({ error: 'Not authorised' });

    const updateData = action === 'approve'
      ? sql`
          UPDATE subscription_meals
          SET status = 'approved', approved_by = 'gifter',
              gifter_feedback = ${feedback ?? null}
          WHERE id = ${req.params.meal_id} AND subscription_id = ${req.params.id}
          RETURNING *
        `
      : sql`
          UPDATE subscription_meals
          SET status = 'rejected', rejected_by = 'gifter',
              rejection_reason = ${reason ?? null},
              gifter_feedback = ${feedback ?? null}
          WHERE id = ${req.params.meal_id} AND subscription_id = ${req.params.id}
          RETURNING *
        `;

    const rows = await updateData;
    if (!rows.length) return res.status(404).json({ error: 'Meal not found' });
    res.json({ meal: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save meal feedback' });
  }
});

module.exports = router;
