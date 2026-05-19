const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/notifications ──────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;

    const notifications = await sql`
      SELECT * FROM notifications
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const unread = await sql`
      SELECT COUNT(*) AS cnt FROM notifications
      WHERE user_id = ${req.user.id} AND is_read = false
    `;

    res.json({ notifications, unread_count: parseInt(unread[0]?.cnt ?? 0) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── PATCH /api/notifications/:id/read ──────────────────────────────────────
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await sql`
      UPDATE notifications
      SET is_read = true
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
    `;
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// ── PATCH /api/notifications/mark-all-read ──────────────────────────────────
router.patch('/mark-all-read', authenticate, async (req, res) => {
  try {
    await sql`
      UPDATE notifications SET is_read = true
      WHERE user_id = ${req.user.id} AND is_read = false
    `;
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
});

// ── PATCH /api/notifications/push-token ─────────────────────────────────────
router.patch('/push-token', authenticate, async (req, res) => {
  try {
    const { push_token } = req.body;
    if (!push_token) return res.status(400).json({ error: 'push_token required' });
    await sql`UPDATE users SET push_token = ${push_token} WHERE id = ${req.user.id}`;
    res.json({ message: 'Push token updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update push token' });
  }
});

module.exports = router;
