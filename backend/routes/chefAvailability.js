const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/chef-availability/:cookId?start=&end= ───────────────────────────
// Public: get availability for a date range
router.get('/:cookId', async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date().toISOString().split('T')[0];
    const endDate   = end   || new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

    const slots = await sql`
      SELECT * FROM chef_availability
      WHERE cook_id = ${req.params.cookId}
        AND date >= ${startDate}::date
        AND date <= ${endDate}::date
      ORDER BY date ASC
    `;
    res.json({ slots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// ── PUT /api/chef-availability/:date — set day availability (cook only) ───────
router.put('/:date', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { is_available, time_slots, notes } = req.body;

    const [slot] = await sql`
      INSERT INTO chef_availability (cook_id, date, is_available, time_slots, notes)
      VALUES (
        ${cooks[0].id}, ${req.params.date}::date,
        ${is_available ?? true},
        ${JSON.stringify(time_slots ?? [])}::jsonb,
        ${notes ?? null}
      )
      ON CONFLICT (cook_id, date) DO UPDATE SET
        is_available = EXCLUDED.is_available,
        time_slots   = EXCLUDED.time_slots,
        notes        = EXCLUDED.notes
      RETURNING *
    `;
    res.json({ slot });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// ── PUT /api/chef-availability/bulk — set many days at once ──────────────────
router.put('/bulk/set', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { dates } = req.body; // [{ date, is_available, time_slots, notes }]
    if (!Array.isArray(dates) || !dates.length) return res.status(400).json({ error: 'dates array required' });

    const results = [];
    for (const d of dates) {
      const [slot] = await sql`
        INSERT INTO chef_availability (cook_id, date, is_available, time_slots, notes)
        VALUES (
          ${cooks[0].id}, ${d.date}::date,
          ${d.is_available ?? true},
          ${JSON.stringify(d.time_slots ?? [])}::jsonb,
          ${d.notes ?? null}
        )
        ON CONFLICT (cook_id, date) DO UPDATE SET
          is_available = EXCLUDED.is_available,
          time_slots   = EXCLUDED.time_slots,
          notes        = EXCLUDED.notes
        RETURNING *
      `;
      results.push(slot);
    }
    res.json({ slots: results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk update availability' });
  }
});

// ── GET /api/chef-availability/my/upcoming — cook sees own calendar ───────────
router.get('/my/upcoming', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.json({ slots: [] });

    const days = parseInt(req.query.days ?? '60', 10);
    const slots = await sql`
      SELECT * FROM chef_availability
      WHERE cook_id = ${cooks[0].id} AND date >= CURRENT_DATE AND date <= CURRENT_DATE + ${days}
      ORDER BY date ASC
    `;
    res.json({ slots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// ── PUT /api/chef-availability/:date/hours — set working hours for a day ──────
router.put('/:date/hours', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { start_time, end_time, max_bookings } = req.body;

    const [slot] = await sql`
      INSERT INTO chef_availability (cook_id, date, is_available, start_time, end_time, max_bookings)
      VALUES (
        ${cooks[0].id}, ${req.params.date}::date,
        true,
        ${start_time ?? null}::time,
        ${end_time ?? null}::time,
        ${max_bookings ?? 1}
      )
      ON CONFLICT (cook_id, date) DO UPDATE SET
        start_time   = EXCLUDED.start_time,
        end_time     = EXCLUDED.end_time,
        max_bookings = EXCLUDED.max_bookings,
        is_available = true
      RETURNING *
    `;
    res.json({ slot });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set working hours' });
  }
});

// ── PUT /api/chef-availability/vacation — block a date range as vacation ──────
router.put('/vacation/set', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { start_date, end_date, notes } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date required' });
    }

    // Generate a row per day in the range
    const results = await sql`
      INSERT INTO chef_availability (cook_id, date, is_available, is_vacation, notes)
      SELECT
        ${cooks[0].id},
        d::date,
        false,
        true,
        ${notes ?? 'Vacation'}
      FROM generate_series(${start_date}::date, ${end_date}::date, '1 day'::interval) AS d
      ON CONFLICT (cook_id, date) DO UPDATE SET
        is_available = false,
        is_vacation  = true,
        notes        = EXCLUDED.notes
      RETURNING *
    `;
    res.json({ slots: results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set vacation period' });
  }
});

// ── PUT /api/chef-availability/blackout — block specific dates ────────────────
router.put('/blackout/set', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { dates, reason } = req.body; // dates: string[]
    if (!Array.isArray(dates) || !dates.length) {
      return res.status(400).json({ error: 'dates array required' });
    }

    const results = [];
    for (const d of dates) {
      const [slot] = await sql`
        INSERT INTO chef_availability (cook_id, date, is_available, is_blackout, notes)
        VALUES (${cooks[0].id}, ${d}::date, false, true, ${reason ?? 'Blackout'})
        ON CONFLICT (cook_id, date) DO UPDATE SET
          is_available = false,
          is_blackout  = true,
          notes        = EXCLUDED.notes
        RETURNING *
      `;
      results.push(slot);
    }
    res.json({ slots: results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set blackout dates' });
  }
});

// ── DELETE /api/chef-availability/:date — clear a day (mark available again) ──
router.delete('/:date', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    await sql`
      UPDATE chef_availability SET
        is_available = true, is_vacation = false, is_blackout = false, notes = null
      WHERE cook_id = ${cooks[0].id} AND date = ${req.params.date}::date
    `;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear date' });
  }
});

module.exports = router;
