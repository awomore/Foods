const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── POST /api/disputes — file a dispute ───────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { order_id, type, reason } = req.body;
    if (!order_id || !type || !reason) {
      return res.status(400).json({ error: 'order_id, type, and reason required' });
    }

    // Verify order belongs to caller
    const orders = await sql`
      SELECT o.id, o.cook_id, o.customer_id, o.total_amount, o.status,
             cp.id AS cook_profile_id
      FROM orders o
      JOIN cook_profiles cp ON cp.id = o.cook_id
      WHERE o.id = ${order_id} AND o.customer_id = ${req.user.id}
    `;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    // Check no open dispute already
    const existing = await sql`
      SELECT id FROM disputes WHERE order_id = ${order_id} AND status NOT IN ('closed','resolved')
    `;
    if (existing.length) return res.status(409).json({ error: 'An open dispute already exists for this order' });

    const [dispute] = await sql`
      INSERT INTO disputes (order_id, customer_id, cook_id, type, reason)
      VALUES (${order_id}, ${req.user.id}, ${order.cook_profile_id}, ${type}, ${reason})
      RETURNING *
    `;

    // Block escrow payout
    await sql`
      UPDATE escrow_holds SET payout_blocked = true
      WHERE order_id = ${order_id} AND status = 'held'
    `;

    // Mark order
    await sql`UPDATE orders SET has_dispute = true WHERE id = ${order_id}`;

    res.status(201).json({ dispute });
  } catch (err) {
    console.error('dispute create:', err);
    res.status(500).json({ error: 'Failed to file dispute' });
  }
});

// ── GET /api/disputes — list caller's disputes ───────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    let disputes;
    if (req.user.role === 'cook') {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ disputes: [] });
      disputes = await sql`
        SELECT d.*, u.full_name AS customer_name,
               o.total_amount AS order_total, o.status AS order_status
        FROM disputes d
        JOIN users u ON u.id = d.customer_id
        JOIN orders o ON o.id = d.order_id
        WHERE d.cook_id = ${cooks[0].id}
        ORDER BY d.created_at DESC
      `;
    } else {
      disputes = await sql`
        SELECT d.*, cp.display_name AS cook_name,
               o.total_amount AS order_total, o.status AS order_status
        FROM disputes d
        JOIN cook_profiles cp ON cp.id = d.cook_id
        JOIN orders o ON o.id = d.order_id
        WHERE d.customer_id = ${req.user.id}
        ORDER BY d.created_at DESC
      `;
    }
    res.json({ disputes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// ── GET /api/disputes/:id — single dispute with evidence + messages ───────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT d.*,
             u.full_name AS customer_name,
             cp.display_name AS cook_name,
             o.total_amount AS order_total
      FROM disputes d
      JOIN users u ON u.id = d.customer_id
      JOIN cook_profiles cp ON cp.id = d.cook_id
      JOIN orders o ON o.id = d.order_id
      WHERE d.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Dispute not found' });
    const dispute = rows[0];

    // Auth: only parties or admin may view
    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;
    const isParty = dispute.customer_id === req.user.id || dispute.cook_id === cookId;
    const isAdmin = req.user.role === 'admin';
    if (!isParty && !isAdmin) return res.status(403).json({ error: 'Access denied' });

    const [evidence, messages] = await Promise.all([
      sql`SELECT * FROM dispute_evidence WHERE dispute_id = ${req.params.id} ORDER BY created_at ASC`,
      sql`
        SELECT dm.*, u.full_name AS sender_name
        FROM dispute_messages dm JOIN users u ON u.id = dm.sender_id
        WHERE dm.dispute_id = ${req.params.id}
        ORDER BY dm.created_at ASC
      `,
    ]);

    res.json({ dispute, evidence, messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

// ── POST /api/disputes/:id/evidence — upload evidence ───────────────────────
router.post('/:id/evidence', authenticate, async (req, res) => {
  try {
    const { file_url, file_type, description } = req.body;
    if (!file_url || !file_type) return res.status(400).json({ error: 'file_url and file_type required' });

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;

    const disputes = await sql`SELECT * FROM disputes WHERE id = ${req.params.id}`;
    if (!disputes.length) return res.status(404).json({ error: 'Dispute not found' });
    const dispute = disputes[0];

    const isParty = dispute.customer_id === req.user.id || dispute.cook_id === cookId;
    const isAdmin = req.user.role === 'admin';
    if (!isParty && !isAdmin) return res.status(403).json({ error: 'Access denied' });

    const role = isAdmin ? 'admin' : req.user.role === 'cook' ? 'cook' : 'customer';
    const [evidence] = await sql`
      INSERT INTO dispute_evidence (dispute_id, submitted_by, role, file_url, file_type, description)
      VALUES (${req.params.id}, ${req.user.id}, ${role}, ${file_url}, ${file_type}, ${description ?? null})
      RETURNING *
    `;

    // Auto-advance status to evidence_review
    if (dispute.status === 'open') {
      await sql`UPDATE disputes SET status = 'evidence_review', updated_at = NOW() WHERE id = ${req.params.id}`;
    }

    res.status(201).json({ evidence });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add evidence' });
  }
});

// ── POST /api/disputes/:id/messages — send a message ────────────────────────
router.post('/:id/messages', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;

    const disputes = await sql`SELECT * FROM disputes WHERE id = ${req.params.id}`;
    if (!disputes.length) return res.status(404).json({ error: 'Dispute not found' });
    const dispute = disputes[0];

    const isParty = dispute.customer_id === req.user.id || dispute.cook_id === cookId;
    const isAdmin = req.user.role === 'admin';
    if (!isParty && !isAdmin) return res.status(403).json({ error: 'Access denied' });

    const role = isAdmin ? 'admin' : req.user.role === 'cook' ? 'cook' : 'customer';
    const [msg] = await sql`
      INSERT INTO dispute_messages (dispute_id, sender_id, role, message)
      VALUES (${req.params.id}, ${req.user.id}, ${role}, ${message.trim()})
      RETURNING *
    `;
    res.status(201).json({ message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── PATCH /api/disputes/:id/resolve — admin resolves ────────────────────────
router.patch('/:id/resolve', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { resolution, resolution_type, refund_amount } = req.body;
    if (!resolution || !resolution_type) {
      return res.status(400).json({ error: 'resolution and resolution_type required' });
    }

    const disputes = await sql`SELECT * FROM disputes WHERE id = ${req.params.id}`;
    if (!disputes.length) return res.status(404).json({ error: 'Dispute not found' });
    const dispute = disputes[0];

    const [updated] = await sql`
      UPDATE disputes SET
        status = 'resolved',
        resolution = ${resolution},
        resolution_type = ${resolution_type},
        refund_amount = ${refund_amount ?? null},
        admin_id = ${req.user.id},
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // Release or refund escrow
    if (resolution_type === 'full_refund') {
      await sql`
        UPDATE escrow_holds SET status = 'refunded', released_at = NOW(), payout_blocked = false
        WHERE order_id = ${dispute.order_id}
      `;
      await sql`UPDATE orders SET status = 'refunded' WHERE id = ${dispute.order_id}`;
    } else if (resolution_type === 'partial_refund' && refund_amount) {
      await sql`
        UPDATE escrow_holds SET
          status = 'partial_refund',
          refund_amount = ${refund_amount},
          released_at = NOW(),
          payout_blocked = false
        WHERE order_id = ${dispute.order_id}
      `;
    } else if (resolution_type === 'no_refund') {
      await sql`
        UPDATE escrow_holds SET status = 'released', released_at = NOW(), payout_blocked = false
        WHERE order_id = ${dispute.order_id}
      `;
    }

    res.json({ dispute: updated });
  } catch (err) {
    console.error('dispute resolve:', err);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ── PATCH /api/disputes/:id/escalate ─────────────────────────────────────────
router.patch('/:id/escalate', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const [updated] = await sql`
      UPDATE disputes SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Dispute not found' });
    res.json({ dispute: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

module.exports = router;
