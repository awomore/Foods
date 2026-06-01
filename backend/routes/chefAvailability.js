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

module.exports = router;
