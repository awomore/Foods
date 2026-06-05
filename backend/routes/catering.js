const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── POST /api/catering — customer creates catering enquiry ───────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      cook_id, event_name, event_type, event_date, event_time,
      guest_count, venue_address, venue_latitude, venue_longitude,
      menu_description, dietary_requirements,
      equipment_needed, service_staff_needed, notes,
    } = req.body;

    if (!event_type || !event_date || !guest_count || !venue_address) {
      return res.status(400).json({ error: 'event_type, event_date, guest_count, venue_address required' });
    }

    const [event] = await sql`
      INSERT INTO catering_events (
        customer_id, cook_id, event_name, event_type, event_date, event_time,
        guest_count, venue_address, venue_latitude, venue_longitude,
        menu_description, dietary_requirements,
        equipment_needed, service_staff_needed, notes
      ) VALUES (
        ${req.user.id},
        ${cook_id ?? null},
        ${event_name ?? null},
        ${event_type},
        ${event_date}::date,
        ${event_time ?? null}::time,
        ${guest_count},
        ${venue_address},
        ${venue_latitude ?? null},
        ${venue_longitude ?? null},
        ${menu_description ?? null},
        ${dietary_requirements ?? null},
        ${equipment_needed ?? false},
        ${service_staff_needed ?? false},
        ${notes ?? null}
      ) RETURNING *
    `;
    res.status(201).json({ event });
  } catch (err) {
    console.error('catering create:', err);
    res.status(500).json({ error: 'Failed to create catering enquiry' });
  }
});

// ── GET /api/catering — list caller's catering events ────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    let events;
    if (req.user.role === 'cook') {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ events: [] });
      events = await sql`
        SELECT ce.*, u.full_name AS customer_name
        FROM catering_events ce JOIN users u ON u.id = ce.customer_id
        WHERE ce.cook_id = ${cooks[0].id}
        ORDER BY ce.event_date ASC
      `;
    } else {
      events = await sql`
        SELECT ce.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
        FROM catering_events ce
        LEFT JOIN cook_profiles cp ON cp.id = ce.cook_id
        WHERE ce.customer_id = ${req.user.id}
        ORDER BY ce.created_at DESC
      `;
    }
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch catering events' });
  }
});

// ── GET /api/catering/:id ────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT ce.*,
             u.full_name AS customer_name, u.phone AS customer_phone,
             cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
      FROM catering_events ce
      JOIN users u ON u.id = ce.customer_id
      LEFT JOIN cook_profiles cp ON cp.id = ce.cook_id
      WHERE ce.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    const event = rows[0];

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const isParty = event.customer_id === req.user.id || event.cook_id === cookRow[0]?.id;
    if (!isParty && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    if (req.user.role === 'cook') delete event.customer_phone;

    res.json({ event });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch catering event' });
  }
});

// ── PATCH /api/catering/:id/quote — cook sends quote ─────────────────────────
router.patch('/:id/quote', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { quote_amount, deposit_amount, quote_message, timeline } = req.body;
    if (!quote_amount) return res.status(400).json({ error: 'quote_amount required' });

    const [updated] = await sql`
      UPDATE catering_events SET
        status = 'quoted',
        quote_amount = ${quote_amount},
        deposit_amount = ${deposit_amount ?? 0},
        quote_message = ${quote_message ?? null},
        timeline = ${JSON.stringify(timeline ?? [])}::jsonb,
        quoted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send quote' });
  }
});

// ── PATCH /api/catering/:id/accept — customer accepts quote ──────────────────
router.patch('/:id/accept', authenticate, async (req, res) => {
  try {
    const [updated] = await sql`
      UPDATE catering_events SET status = 'accepted', updated_at = NOW()
      WHERE id = ${req.params.id} AND customer_id = ${req.user.id} AND status = 'quoted'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Event not found or not in quoted state' });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

// ── PATCH /api/catering/:id/deposit-paid ─────────────────────────────────────
router.patch('/:id/deposit-paid', authenticate, async (req, res) => {
  try {
    const { tx_ref, transaction_id } = req.body;
    const [updated] = await sql`
      UPDATE catering_events SET
        status = 'deposit_paid',
        deposit_tx_ref = ${tx_ref ?? null},
        deposit_paid_at = NOW(),
        updated_at = NOW()
      WHERE id = ${req.params.id} AND customer_id = ${req.user.id} AND status = 'accepted'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Event not found or not in accepted state' });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record deposit' });
  }
});

// ── PATCH /api/catering/:id/complete ─────────────────────────────────────────
router.patch('/:id/complete', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { final_tx_ref, final_amount } = req.body;
    const [updated] = await sql`
      UPDATE catering_events SET
        status = 'completed',
        final_amount = ${final_amount ?? null},
        final_tx_ref = ${final_tx_ref ?? null},
        final_paid_at = NOW(),
        updated_at = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete event' });
  }
});

// ── PATCH /api/catering/:id/cancel ───────────────────────────────────────────
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;

    const events = await sql`SELECT * FROM catering_events WHERE id = ${req.params.id}`;
    if (!events.length) return res.status(404).json({ error: 'Event not found' });
    const event = events[0];
    const isParty = event.customer_id === req.user.id || event.cook_id === cookId;
    if (!isParty) return res.status(403).json({ error: 'Access denied' });

    const [updated] = await sql`
      UPDATE catering_events SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel event' });
  }
});

// ── PATCH /api/catering/:id/timeline — cook updates timeline ─────────────────
router.patch('/:id/timeline', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { timeline } = req.body;
    if (!Array.isArray(timeline)) return res.status(400).json({ error: 'timeline array required' });

    const [updated] = await sql`
      UPDATE catering_events SET
        timeline = ${JSON.stringify(timeline)}::jsonb, updated_at = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update timeline' });
  }
});

module.exports = router;
