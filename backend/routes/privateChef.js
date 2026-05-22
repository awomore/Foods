const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

router.post('/', authenticate, async (req, res) => {
  try {
    const {
      cook_id, event_type, event_date, event_time, guest_count,
      venue_address, venue_latitude, venue_longitude,
      description, dietary_requirements,
    } = req.body;

    if (!cook_id || !event_date || !guest_count || !venue_address) {
      return res.status(400).json({ error: 'cook_id, event_date, guest_count, and venue_address required' });
    }

    const booking = await sql`
      INSERT INTO private_chef_bookings (
        customer_id, cook_id, event_type, event_date, event_time, guest_count,
        venue_address, venue_latitude, venue_longitude, description, dietary_requirements
      ) VALUES (
        ${req.user.id}, ${cook_id}, ${event_type ?? null}, ${event_date}::date,
        ${event_time ?? null}::time, ${guest_count},
        ${venue_address}, ${venue_latitude ?? null}, ${venue_longitude ?? null},
        ${description ?? null}, ${dietary_requirements ?? null}
      )
      RETURNING *
    `;
    res.status(201).json({ booking: booking[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create booking enquiry' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const isCook = req.user.role === 'cook';
    let bookings;
    if (isCook) {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ bookings: [] });
      bookings = await sql`
        SELECT pcb.*, u.full_name AS customer_name, u.phone AS customer_phone
        FROM private_chef_bookings pcb JOIN users u ON u.id = pcb.customer_id
        WHERE pcb.cook_id = ${cooks[0].id} ORDER BY pcb.event_date ASC
      `;
    } else {
      bookings = await sql`
        SELECT pcb.*, cp.display_name AS cook_name
        FROM private_chef_bookings pcb JOIN cook_profiles cp ON cp.id = pcb.cook_id
        WHERE pcb.customer_id = ${req.user.id} ORDER BY pcb.event_date ASC
      `;
    }
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.patch('/:id/quote', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { quote_amount, quote_breakdown, quote_message, deposit_amount } = req.body;
    if (!quote_amount) return res.status(400).json({ error: 'quote_amount required' });

    const balance = quote_amount - (deposit_amount ?? 0);
    const updated = await sql`
      UPDATE private_chef_bookings SET
        status = 'quoted', quote_amount = ${quote_amount},
        quote_breakdown = ${quote_breakdown ? JSON.stringify(quote_breakdown) : null}::jsonb,
        quote_message = ${quote_message ?? null}, quoted_at = NOW(),
        deposit_amount = ${deposit_amount ?? 0}, balance_amount = ${balance}
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated.length) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to quote booking' });
  }
});

// ── PATCH /api/private-chef/:id/deposit-paid ────────────────────────────────
// Called after Flutterwave deposit payment succeeds
router.patch('/:id/deposit-paid', authenticate, async (req, res) => {
  try {
    const { tx_ref, transaction_id } = req.body;

    const updated = await sql`
      UPDATE private_chef_bookings
      SET status = 'deposit_paid',
          deposit_tx_ref = ${tx_ref ?? null},
          deposit_transaction_id = ${transaction_id ?? null},
          deposit_paid_at = NOW()
      WHERE id = ${req.params.id}
        AND customer_id = ${req.user.id}
        AND status = 'quoted'
      RETURNING *
    `;
    if (!updated.length) return res.status(404).json({ error: 'Booking not found or not in quoted state' });
    res.json({ booking: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record deposit payment' });
  }
});

module.exports = router;
