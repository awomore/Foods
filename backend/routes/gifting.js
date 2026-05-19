const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
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

    // Add loyalty-equivalent balance to customer
    await sql`
      INSERT INTO loyalty_points (customer_id, balance, lifetime_earned)
      VALUES (${req.user.id}, ${Math.floor(card.denomination)}, ${Math.floor(card.denomination)})
      ON CONFLICT (customer_id) DO UPDATE
      SET balance = loyalty_points.balance + ${Math.floor(card.denomination)},
          lifetime_earned = loyalty_points.lifetime_earned + ${Math.floor(card.denomination)}
    `;

    res.json({ redeemed: true, amount: card.denomination });
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

module.exports = router;
