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

// ── GET /api/custom-requests/:id — single request detail ─────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT cr.*,
             u.full_name  AS customer_name,
             u.avatar_url AS customer_avatar,
             cp.display_name AS cook_name,
             cp.avatar_url   AS cook_avatar
      FROM custom_requests cr
      JOIN users u         ON u.id  = cr.customer_id
      JOIN cook_profiles cp ON cp.id = cr.cook_id
      WHERE cr.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });
    const req_ = rows[0];

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;
    const isParty = req_.customer_id === req.user.id || req_.cook_id === cookId;
    if (!isParty && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const messages = await sql`
      SELECT crm.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar
      FROM custom_request_messages crm
      JOIN users u ON u.id = crm.sender_id
      WHERE crm.request_id = ${req.params.id}
      ORDER BY crm.created_at ASC
    `;

    res.json({ request: req_, messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// ── POST /api/custom-requests/:id/messages — send a negotiation message ───────
router.post('/:id/messages', authenticate, async (req, res) => {
  try {
    const { message, attachments } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    const rows = await sql`SELECT * FROM custom_requests WHERE id = ${req.params.id}`;
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });
    const req_ = rows[0];

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;
    const isParty = req_.customer_id === req.user.id || req_.cook_id === cookId;
    if (!isParty) return res.status(403).json({ error: 'Access denied' });

    const role = req.user.role === 'cook' ? 'cook' : 'customer';

    const [msg] = await sql`
      INSERT INTO custom_request_messages (request_id, sender_id, role, message, attachments)
      VALUES (${req.params.id}, ${req.user.id}, ${role}, ${message.trim()},
              ${attachments ?? []}::text[])
      RETURNING *
    `;
    res.status(201).json({ message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── PATCH /api/custom-requests/:id/requote — cook sends a revised quote ───────
router.patch('/:id/requote', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { quote_amount, quote_message } = req.body;
    if (!quote_amount) return res.status(400).json({ error: 'quote_amount required' });

    const rows = await sql`
      SELECT * FROM custom_requests WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Request not found' });
    const req_ = rows[0];

    const existingVersions = Array.isArray(req_.quote_versions) ? req_.quote_versions : [];
    const newVersion = {
      version: existingVersions.length + 1,
      amount: quote_amount,
      message: quote_message ?? null,
      at: new Date().toISOString(),
    };
    existingVersions.push(newVersion);

    const [updated] = await sql`
      UPDATE custom_requests SET
        status          = 'quoted',
        quote_amount    = ${quote_amount},
        quote_message   = ${quote_message ?? null},
        quote_versions  = ${JSON.stringify(existingVersions)}::jsonb,
        revision_count  = ${existingVersions.length},
        quoted_at       = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    res.json({ request: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit revised quote' });
  }
});

// ── PATCH /api/custom-requests/:id/revise — customer requests revision ────────
router.patch('/:id/revise', authenticate, async (req, res) => {
  try {
    const { revision_notes, new_budget, new_delivery_date, new_quantity } = req.body;

    const [updated] = await sql`
      UPDATE custom_requests SET
        status             = 'revision_requested',
        negotiation_notes  = ${revision_notes ?? null},
        budget_range       = ${new_budget ?? null},
        delivery_date      = ${new_delivery_date ?? null}::date,
        quantity           = ${new_quantity ?? null}
      WHERE id = ${req.params.id} AND customer_id = ${req.user.id}
        AND status IN ('quoted')
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Request not found or not in quoted state' });
    res.json({ request: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request revision' });
  }
});

// ── PATCH /api/custom-requests/:id/escrow — link accepted request to escrow ───
router.patch('/:id/escrow', authenticate, async (req, res) => {
  try {
    const { escrow_hold_id } = req.body;
    if (!escrow_hold_id) return res.status(400).json({ error: 'escrow_hold_id required' });

    const [updated] = await sql`
      UPDATE custom_requests SET escrow_hold_id = ${escrow_hold_id}
      WHERE id = ${req.params.id} AND customer_id = ${req.user.id}
        AND status = 'accepted'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Request not found or not in accepted state' });
    res.json({ request: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to link escrow' });
  }
});

module.exports = router;
