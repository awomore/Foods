const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── POST /api/custom-requests ────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { cook_id, description, photos, serving_count, preferred_date, budget_range } = req.body;
    if (!cook_id || !description) {
      return res.status(400).json({ error: 'cook_id and description required' });
    }

    const req_ = await sql`
      INSERT INTO custom_requests (customer_id, cook_id, description, photos, serving_count, preferred_date, budget_range)
      VALUES (${req.user.id}, ${cook_id}, ${description}, ${photos ?? []}::text[],
              ${serving_count ?? null}, ${preferred_date ?? null}::date, ${budget_range ?? null})
      RETURNING *
    `;
    res.status(201).json({ request: req_[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// ── GET /api/custom-requests ─────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const isCook = req.user.role === 'cook';
    let requests;

    if (isCook) {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ requests: [] });
      requests = await sql`
        SELECT cr.*, u.full_name AS customer_name, u.avatar_url AS customer_avatar
        FROM custom_requests cr JOIN users u ON u.id = cr.customer_id
        WHERE cr.cook_id = ${cooks[0].id}
        ORDER BY cr.created_at DESC
      `;
    } else {
      requests = await sql`
        SELECT cr.*, cp.display_name AS cook_name
        FROM custom_requests cr JOIN cook_profiles cp ON cp.id = cr.cook_id
        WHERE cr.customer_id = ${req.user.id}
        ORDER BY cr.created_at DESC
      `;
    }
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// ── PATCH /api/custom-requests/:id/quote ────────────────────────────────────
router.patch('/:id/quote', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { quote_amount, quote_message } = req.body;
    if (!quote_amount) return res.status(400).json({ error: 'quote_amount required' });

    const updated = await sql`
      UPDATE custom_requests
      SET status = 'quoted', quote_amount = ${quote_amount},
          quote_message = ${quote_message ?? null}, quoted_at = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated.length) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to quote request' });
  }
});

// ── PATCH /api/custom-requests/:id/respond ──────────────────────────────────
router.patch('/:id/respond', authenticate, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' | 'decline'
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'action must be accept or decline' });
    }

    const updated = await sql`
      UPDATE custom_requests
      SET status = ${action === 'accept' ? 'accepted' : 'declined'}
      WHERE id = ${req.params.id} AND customer_id = ${req.user.id}
      RETURNING *
    `;
    if (!updated.length) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond to request' });
  }
});

module.exports = router;
