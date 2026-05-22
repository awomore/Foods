const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

async function getCookId(userId) {
  const rows = await sql`SELECT id FROM cook_profiles WHERE user_id = ${userId} LIMIT 1`;
  return rows[0]?.id ?? null;
}

// ── POST /api/discounts ─────────────────────────────────────────────────────
// Cook creates a discount on their entire menu or a specific mode.
router.post('/', authenticate, async (req, res) => {
  try {
    const cookId = await getCookId(req.user.id);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });

    const {
      type, discount_value, min_orders_required = 0,
      free_item_description, applies_to = 'all',
      starts_at, ends_at,
    } = req.body;

    const validTypes = ['general_pct', 'general_delivery', 'loyalty_pct', 'loyalty_freeitem'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'type must be one of: ' + validTypes.join(', ') });
    }
    if (type !== 'loyalty_freeitem' && (discount_value == null || discount_value <= 0)) {
      return res.status(400).json({ error: 'discount_value required for this type' });
    }
    if (type === 'general_pct' && discount_value > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100' });
    }

    const discount = await sql`
      INSERT INTO cook_discounts (
        cook_id, type, discount_value, min_orders_required,
        free_item_description, applies_to, starts_at, ends_at, is_active
      ) VALUES (
        ${cookId}, ${type}, ${discount_value ?? null}, ${min_orders_required},
        ${free_item_description ?? null}, ${applies_to},
        ${starts_at ?? null}::timestamptz, ${ends_at ?? null}::timestamptz, true
      )
      RETURNING *
    `;

    res.status(201).json({ discount: discount[0] });
  } catch (err) {
    console.error('POST /discounts:', err);
    res.status(500).json({ error: 'Failed to create discount' });
  }
});

// ── GET /api/discounts ──────────────────────────────────────────────────────
// Cook lists all their discounts.
router.get('/', authenticate, async (req, res) => {
  try {
    const cookId = await getCookId(req.user.id);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });

    const discounts = await sql`
      SELECT * FROM cook_discounts
      WHERE cook_id = ${cookId}
      ORDER BY created_at DESC
    `;

    res.json({ discounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch discounts' });
  }
});

// ── GET /api/discounts/cook/:cookId ─────────────────────────────────────────
// Public — returns active discounts for a specific cook (for customer display).
router.get('/cook/:cookId', async (req, res) => {
  try {
    const discounts = await sql`
      SELECT * FROM cook_discounts
      WHERE cook_id = ${req.params.cookId}
        AND is_active = true
        AND (ends_at IS NULL OR ends_at > NOW())
        AND (starts_at IS NULL OR starts_at <= NOW())
      ORDER BY created_at DESC
    `;
    res.json({ discounts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch discounts' });
  }
});

// ── PATCH /api/discounts/:id ────────────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const cookId = await getCookId(req.user.id);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });

    const { discount_value, ends_at, is_active, applies_to } = req.body;

    const updated = await sql`
      UPDATE cook_discounts SET
        discount_value = COALESCE(${discount_value ?? null}, discount_value),
        ends_at        = COALESCE(${ends_at ?? null}::timestamptz, ends_at),
        is_active      = COALESCE(${is_active ?? null}, is_active),
        applies_to     = COALESCE(${applies_to ?? null}, applies_to)
      WHERE id = ${req.params.id} AND cook_id = ${cookId}
      RETURNING *
    `;

    if (!updated.length) return res.status(404).json({ error: 'Discount not found' });
    res.json({ discount: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update discount' });
  }
});

// ── DELETE /api/discounts/:id ───────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cookId = await getCookId(req.user.id);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });

    const deleted = await sql`
      DELETE FROM cook_discounts WHERE id = ${req.params.id} AND cook_id = ${cookId}
      RETURNING id
    `;
    if (!deleted.length) return res.status(404).json({ error: 'Discount not found' });
    res.json({ message: 'Discount removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete discount' });
  }
});

module.exports = router;
