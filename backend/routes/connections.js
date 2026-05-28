const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── POST /api/connections/request ───────────────────────────────────────────
// Send a connection request to another user, optionally tied to a shared order.
router.post('/request', authenticate, async (req, res) => {
  try {
    const { recipient_id, order_id } = req.body;
    if (!recipient_id) return res.status(400).json({ error: 'recipient_id required' });
    if (recipient_id === req.user.id) return res.status(400).json({ error: 'Cannot befriend yourself' });

    // Check if connection already exists in either direction
    const existing = await sql`
      SELECT id, status FROM user_connections
      WHERE (requester_id = ${req.user.id} AND recipient_id = ${recipient_id})
         OR (requester_id = ${recipient_id} AND recipient_id = ${req.user.id})
    `;
    if (existing.length) {
      const s = existing[0].status;
      if (s === 'accepted') return res.status(409).json({ error: 'Already connected' });
      if (s === 'pending') return res.status(409).json({ error: 'Request already sent' });
      if (s === 'blocked') return res.status(403).json({ error: 'Cannot connect' });
    }

    const [conn] = await sql`
      INSERT INTO user_connections (requester_id, recipient_id, status, shared_order_id)
      VALUES (${req.user.id}, ${recipient_id}, 'pending', ${order_id ?? null})
      RETURNING *
    `;
    res.status(201).json({ connection: conn });
  } catch (err) {
    console.error('Connection request error:', err);
    res.status(500).json({ error: 'Failed to send connection request' });
  }
});

// ── GET /api/connections ─────────────────────────────────────────────────────
// List my accepted connections and pending requests
router.get('/', authenticate, async (req, res) => {
  try {
    const connections = await sql`
      SELECT uc.*,
             CASE
               WHEN uc.requester_id = ${req.user.id} THEN uc.recipient_id
               ELSE uc.requester_id
             END AS other_user_id,
             u.full_name AS other_name,
             u.username  AS other_username,
             u.avatar_url AS other_avatar
      FROM user_connections uc
      JOIN users u ON u.id = CASE
        WHEN uc.requester_id = ${req.user.id} THEN uc.recipient_id
        ELSE uc.requester_id
      END
      WHERE (uc.requester_id = ${req.user.id} OR uc.recipient_id = ${req.user.id})
        AND uc.status != 'blocked'
      ORDER BY uc.created_at DESC
    `;
    res.json({ connections });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// ── PATCH /api/connections/:id/respond ──────────────────────────────────────
// Accept or block a pending connection request (recipient only)
router.patch('/:id/respond', authenticate, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' | 'block'
    if (!['accept', 'block'].includes(action)) return res.status(400).json({ error: 'action must be accept or block' });

    const [conn] = await sql`
      UPDATE user_connections
      SET status = ${action === 'accept' ? 'accepted' : 'blocked'}
      WHERE id = ${req.params.id} AND recipient_id = ${req.user.id} AND status = 'pending'
      RETURNING *
    `;
    if (!conn) return res.status(404).json({ error: 'Request not found' });
    res.json({ connection: conn });
  } catch (err) {
    res.status(500).json({ error: 'Failed to respond to connection' });
  }
});

// ── GET /api/connections/status/:userId ─────────────────────────────────────
// Check connection status with a specific user
router.get('/status/:userId', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, status, requester_id FROM user_connections
      WHERE (requester_id = ${req.user.id} AND recipient_id = ${req.params.userId})
         OR (requester_id = ${req.params.userId} AND recipient_id = ${req.user.id})
      LIMIT 1
    `;
    if (!rows.length) return res.json({ status: 'none' });
    const c = rows[0];
    res.json({
      status: c.status,
      connection_id: c.id,
      is_requester: c.requester_id === req.user.id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

module.exports = router;
