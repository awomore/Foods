const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { cookCurrency, DEFAULT_CURRENCY } = require('../utils/currency');
const { toMinor, fromMinor } = require('../payments/money');
const { PaymentError, verifyPayment, consumeClaim } = require('../payments/claims');

/**
 * Verify `tx_ref` pays at least `amount` of the booking's currency and spend it
 * on `purpose` inside `grant`, the transaction that records the payment.
 * Returns whatever grant returns.
 */
async function payForBooking(booking, { tx_ref, userId, amount, purpose }, grant) {
  const currency = booking.currency_code ?? DEFAULT_CURRENCY;
  const amountMinor = toMinor(amount ?? 0, currency);
  if (amountMinor <= 0) throw new PaymentError(400, 'Nothing to pay on this booking');
  const { paidMinor } = await verifyPayment({ reference: tx_ref, userId, currency, amountMinor });
  return sql.begin(async sql => {
    await consumeClaim(sql, { reference: tx_ref, purpose, userId, currency, paidMinor, useMinor: paidMinor });
    return grant(sql, { paidMinor, amountMinor, currency });
  });
}

// ── POST /api/private-chef — customer creates booking enquiry ─────────────────
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

    const [booking] = await sql`
      INSERT INTO private_chef_bookings (
        customer_id, cook_id, event_type, event_date, event_time, guest_count,
        venue_address, venue_latitude, venue_longitude, description, dietary_requirements,
        currency_code
      ) VALUES (
        ${req.user.id}, ${cook_id}, ${event_type ?? null}, ${event_date}::date,
        ${event_time ?? null}::time, ${guest_count},
        ${venue_address}, ${venue_latitude ?? null}, ${venue_longitude ?? null},
        ${description ?? null}, ${dietary_requirements ?? null},
        ${await cookCurrency(sql, cook_id)}
      )
      RETURNING *
    `;
    res.status(201).json({ booking });
  } catch (err) {
    console.error('private chef create:', err);
    res.status(500).json({ error: 'Failed to create booking enquiry' });
  }
});

// ── GET /api/private-chef — list caller's bookings ────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const isCook = req.user.role === 'cook';
    let bookings;
    if (isCook) {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ bookings: [] });
      bookings = await sql`
        SELECT pcb.*, u.full_name AS customer_name
        FROM private_chef_bookings pcb JOIN users u ON u.id = pcb.customer_id
        WHERE pcb.cook_id = ${cooks[0].id} ORDER BY pcb.event_date ASC
      `;
    } else {
      bookings = await sql`
        SELECT pcb.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
        FROM private_chef_bookings pcb JOIN cook_profiles cp ON cp.id = pcb.cook_id
        WHERE pcb.customer_id = ${req.user.id} ORDER BY pcb.event_date ASC
      `;
    }
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ── GET /api/private-chef/:id ─────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT pcb.*,
             u.full_name AS customer_name, u.phone AS customer_phone,
             cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
      FROM private_chef_bookings pcb
      JOIN users u ON u.id = pcb.customer_id
      JOIN cook_profiles cp ON cp.id = pcb.cook_id
      WHERE pcb.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = rows[0];

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const isParty = booking.customer_id === req.user.id || booking.cook_id === cookRow[0]?.id;
    if (!isParty && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    if (req.user.role === 'cook') delete booking.customer_phone;

    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// ── PATCH /api/private-chef/:id/quote — cook sends initial quote ──────────────
router.patch('/:id/quote', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { quote_amount, quote_breakdown, quote_message, deposit_amount } = req.body;
    if (!quote_amount) return res.status(400).json({ error: 'quote_amount required' });

    const balance = quote_amount - (deposit_amount ?? 0);
    const [updated] = await sql`
      UPDATE private_chef_bookings SET
        status = 'quoted', quote_amount = ${quote_amount},
        quote_breakdown = ${quote_breakdown ? sql.json(quote_breakdown) : null}::jsonb,
        quote_message = ${quote_message ?? null}, quoted_at = NOW(),
        deposit_amount = ${deposit_amount ?? 0}, balance_amount = ${balance}
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to quote booking' });
  }
});

// ── PATCH /api/private-chef/:id/counter-offer — customer counter-offers ───────
router.patch('/:id/counter-offer', authenticate, async (req, res) => {
  try {
    const { counter_offer_amount, counter_offer_notes } = req.body;
    if (!counter_offer_amount) return res.status(400).json({ error: 'counter_offer_amount required' });

    const [updated] = await sql`
      UPDATE private_chef_bookings SET
        status = 'counter_offered',
        counter_offer_amount = ${counter_offer_amount},
        counter_offer_notes  = ${counter_offer_notes ?? null},
        counter_offered_at   = NOW()
      WHERE id = ${req.params.id}
        AND customer_id = ${req.user.id}
        AND status IN ('quoted')
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Booking not found or not in quoted state' });
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit counter-offer' });
  }
});

// ── PATCH /api/private-chef/:id/accept-counter — cook accepts counter-offer ───
router.patch('/:id/accept-counter', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const bookings = await sql`SELECT * FROM private_chef_bookings WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}`;
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found' });
    const b = bookings[0];

    const newAmount = b.counter_offer_amount ?? b.quote_amount;
    const [updated] = await sql`
      UPDATE private_chef_bookings SET
        status = 'accepted',
        quote_amount = ${newAmount},
        balance_amount = ${newAmount - (b.deposit_amount ?? 0)}
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept counter-offer' });
  }
});

// ── PATCH /api/private-chef/:id/accept — customer accepts quote as-is ─────────
router.patch('/:id/accept', authenticate, async (req, res) => {
  try {
    const [updated] = await sql`
      UPDATE private_chef_bookings SET status = 'accepted'
      WHERE id = ${req.params.id}
        AND customer_id = ${req.user.id}
        AND status IN ('quoted','counter_offered')
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept booking' });
  }
});

// ── PATCH /api/private-chef/:id/contract — cook uploads contract ──────────────
router.patch('/:id/contract', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { contract_url } = req.body;
    if (!contract_url) return res.status(400).json({ error: 'contract_url required' });

    const [updated] = await sql`
      UPDATE private_chef_bookings SET
        status = 'contract_sent', contract_url = ${contract_url}
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id} AND status = 'accepted'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Booking not found or not in accepted state' });
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to attach contract' });
  }
});

// ── PATCH /api/private-chef/:id/sign-contract — customer signs ───────────────
router.patch('/:id/sign-contract', authenticate, async (req, res) => {
  try {
    const [updated] = await sql`
      UPDATE private_chef_bookings SET contract_signed_at = NOW()
      WHERE id = ${req.params.id}
        AND customer_id = ${req.user.id}
        AND status = 'contract_sent'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Booking not found or contract not sent' });
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// ── PATCH /api/private-chef/:id/deposit-paid ─────────────────────────────────
router.patch('/:id/deposit-paid', authenticate, async (req, res) => {
  try {
    const { tx_ref, transaction_id } = req.body;
    const [booking] = await sql`
      SELECT * FROM private_chef_bookings WHERE id = ${req.params.id} AND customer_id = ${req.user.id}
    `;
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (tx_ref && booking.status === 'deposit_paid' && booking.deposit_tx_ref === tx_ref) {
      return res.json({ booking, already_applied: true });
    }
    if (!['quoted', 'accepted', 'contract_sent'].includes(booking.status)) {
      return res.status(404).json({ error: 'Booking not found or not in valid state' });
    }

    const [updated] = await payForBooking(booking, {
      tx_ref, userId: req.user.id, amount: booking.deposit_amount, purpose: 'chef_deposit',
    }, (sql, { paidMinor, amountMinor, currency }) => {
      // The fee is what was actually paid on top of the deposit, at most 5%.
      const feeMinor = Math.min(paidMinor - amountMinor, Math.round(amountMinor * 0.05));
      return sql`
        UPDATE private_chef_bookings SET
          status = 'deposit_paid',
          deposit_tx_ref = ${tx_ref},
          deposit_transaction_id = ${transaction_id ?? null},
          deposit_platform_fee = ${Math.round(fromMinor(feeMinor, currency))},
          deposit_paid_at = NOW()
        WHERE id = ${req.params.id}
          AND customer_id = ${req.user.id}
          AND status IN ('quoted','accepted','contract_sent')
        RETURNING *
      `;
    });
    if (!updated) return res.status(409).json({ error: 'Booking is no longer awaiting a deposit' });
    res.json({ booking: updated });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to record deposit payment' });
  }
});

// ── PATCH /api/private-chef/:id/milestone — record milestone payment ──────────
router.patch('/:id/milestone', authenticate, async (req, res) => {
  try {
    const { milestone_index, tx_ref, amount, label } = req.body;
    if (!Number.isInteger(milestone_index) || milestone_index < 0 || milestone_index > 20 || !amount) {
      return res.status(400).json({ error: 'milestone_index and amount required' });
    }

    const bookings = await sql`SELECT * FROM private_chef_bookings WHERE id = ${req.params.id}`;
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found' });
    const booking = bookings[0];
    if (booking.customer_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const existing = Array.isArray(booking.milestone_payments) ? booking.milestone_payments : [];
    if (existing[milestone_index]?.tx_ref) {
      if (existing[milestone_index].tx_ref === tx_ref) return res.json({ booking, already_applied: true });
      return res.status(409).json({ error: 'That milestone is already paid' });
    }

    const [updated] = await payForBooking(booking, {
      tx_ref, userId: req.user.id, amount, purpose: 'chef_milestone',
    }, async (sql, { paidMinor, currency }) => {
      // Re-read under a row lock so two milestones paid at once can't overwrite each other.
      const [row] = await sql`SELECT milestone_payments FROM private_chef_bookings WHERE id = ${req.params.id} FOR UPDATE`;
      const milestones = Array.isArray(row.milestone_payments) ? row.milestone_payments : [];
      if (milestones[milestone_index]?.tx_ref) throw new PaymentError(409, 'That milestone is already paid');
      milestones[milestone_index] = {
        index: milestone_index,
        label: label ?? `Milestone ${milestone_index + 1}`,
        amount: fromMinor(paidMinor, currency),
        tx_ref,
        paid_at: new Date().toISOString(),
      };
      return sql`
        UPDATE private_chef_bookings SET
          milestone_payments = ${sql.json(milestones)}::jsonb
        WHERE id = ${req.params.id}
        RETURNING *
      `;
    });
    res.json({ booking: updated });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to record milestone payment' });
  }
});

// ── PATCH /api/private-chef/:id/balance-paid — final balance payment ──────────
router.patch('/:id/balance-paid', authenticate, async (req, res) => {
  try {
    const { tx_ref, transaction_id } = req.body;
    const [booking] = await sql`
      SELECT * FROM private_chef_bookings WHERE id = ${req.params.id} AND customer_id = ${req.user.id}
    `;
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (tx_ref && booking.balance_tx_ref === tx_ref) return res.json({ booking, already_applied: true });
    if (booking.status !== 'deposit_paid') {
      return res.status(404).json({ error: 'Booking not found or not in deposit_paid state' });
    }

    const balance = booking.balance_amount ?? (Number(booking.quote_amount ?? 0) - Number(booking.deposit_amount ?? 0));
    const [updated] = await payForBooking(booking, {
      tx_ref, userId: req.user.id, amount: balance, purpose: 'chef_balance',
    }, (sql) => sql`
      UPDATE private_chef_bookings SET
        status = 'in_progress',
        balance_paid = true,
        balance_tx_ref = ${tx_ref},
        balance_transaction_id = ${transaction_id ?? null},
        balance_paid_at = NOW()
      WHERE id = ${req.params.id}
        AND customer_id = ${req.user.id}
        AND status = 'deposit_paid'
      RETURNING *
    `);
    if (!updated) return res.status(409).json({ error: 'Booking is no longer awaiting its balance' });
    res.json({ booking: updated });
  } catch (err) {
    if (err instanceof PaymentError) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: 'Failed to record balance payment' });
  }
});

// ── PATCH /api/private-chef/:id/complete ──────────────────────────────────────
router.patch('/:id/complete', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const [updated] = await sql`
      UPDATE private_chef_bookings SET status = 'completed'
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

// ── PATCH /api/private-chef/:id/cancel ────────────────────────────────────────
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const cookId = cookRow[0]?.id;

    const bookings = await sql`SELECT * FROM private_chef_bookings WHERE id = ${req.params.id}`;
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found' });
    const b = bookings[0];
    const isParty = b.customer_id === req.user.id || b.cook_id === cookId;
    if (!isParty) return res.status(403).json({ error: 'Access denied' });

    const [updated] = await sql`
      UPDATE private_chef_bookings SET status = 'cancelled'
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;
