const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/weekly-menus/:cookId — public: get a cook's weekly menus ─────────
router.get('/:cookId', async (req, res) => {
  try {
    const { limit = 4 } = req.query;
    const menus = await sql`
      SELECT * FROM weekly_menus
      WHERE cook_id = ${req.params.cookId} AND is_published = true
      ORDER BY week_start DESC LIMIT ${+limit}
    `;
    res.json({ menus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weekly menus' });
  }
});

// ── GET /api/weekly-menus/my/all — cook sees own menus ────────────────────────
router.get('/my/all', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.json({ menus: [] });
    const menus = await sql`
      SELECT * FROM weekly_menus WHERE cook_id = ${cooks[0].id} ORDER BY week_start DESC
    `;
    res.json({ menus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weekly menus' });
  }
});

// ── PUT /api/weekly-menus/:weekStart — upsert week's menu ────────────────────
router.put('/:weekStart', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { title, description, items, is_published } = req.body;

    const [menu] = await sql`
      INSERT INTO weekly_menus (cook_id, week_start, title, description, items, is_published)
      VALUES (
        ${cooks[0].id}, ${req.params.weekStart}::date,
        ${title ?? null}, ${description ?? null},
        ${JSON.stringify(items ?? [])}::jsonb,
        ${is_published ?? false}
      )
      ON CONFLICT (cook_id, week_start) DO UPDATE SET
        title        = EXCLUDED.title,
        description  = EXCLUDED.description,
        items        = EXCLUDED.items,
        is_published = EXCLUDED.is_published,
        updated_at   = NOW()
      RETURNING *
    `;
    res.json({ menu });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert weekly menu' });
  }
});

// ── DELETE /api/weekly-menus/:weekStart ───────────────────────────────────────
router.delete('/:weekStart', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    await sql`
      DELETE FROM weekly_menus
      WHERE cook_id = ${cooks[0].id} AND week_start = ${req.params.weekStart}::date
    `;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete menu' });
  }
});

module.exports = router;
