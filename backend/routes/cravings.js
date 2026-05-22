const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// Helper: increment weekly public counter, reset if new week
async function bumpPublicCount(cravingId) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  await sql`
    UPDATE cravings SET
      public_shown_this_week = CASE
        WHEN public_shown_week_start IS DISTINCT FROM ${weekStartStr}::date THEN 1
        ELSE public_shown_this_week + 1
      END,
      public_shown_week_start = ${weekStartStr}::date
    WHERE id = ${cravingId}
  `;
}

// ── GET /api/cravings  (own cravings — all, fulfilled + unfulfilled) ─────────
router.get('/', authenticate, async (req, res) => {
  try {
    const cravings = await sql`
      SELECT * FROM cravings WHERE user_id = ${req.user.id}
      ORDER BY is_fulfilled ASC, created_at DESC
    `;
    res.json({ cravings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cravings' });
  }
});

// ── GET /api/cravings/user/:userId  (public cravings for a profile page) ─────
// Shows only non-fulfilled public cravings; enforces weekly 5-show cap on public feed
router.get('/user/:userId', async (req, res) => {
  try {
    const cravings = await sql`
      SELECT c.*, u.full_name AS user_name, u.avatar_url AS user_avatar
      FROM cravings c
      JOIN users u ON u.id = c.user_id
      WHERE c.user_id = ${req.params.userId}
        AND c.is_public = true
        AND c.is_fulfilled = false
      ORDER BY c.created_at DESC
    `;

    // Bump public show counters (fire-and-forget)
    for (const c of cravings) {
      if ((c.public_shown_this_week ?? 0) < 5) {
        bumpPublicCount(c.id).catch(() => {});
      }
    }

    // Filter out cravings that have exceeded 5 public shows this week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const visible = cravings.filter(c => {
      const sameWeek = c.public_shown_week_start &&
        new Date(c.public_shown_week_start).getTime() >= weekStart.getTime();
      return !sameWeek || (c.public_shown_this_week ?? 0) <= 5;
    });

    res.json({ cravings: visible });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cravings' });
  }
});

// ── GET /api/cravings/cook  (cravings for the authenticated cook's dishes) ───
// Always visible to cooks regardless of weekly cap
router.get('/cook', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const cravings = await sql`
      SELECT c.*, u.full_name AS user_name, u.avatar_url AS user_avatar
      FROM cravings c
      JOIN users u ON u.id = c.user_id
      WHERE c.cook_id = ${cooks[0].id} AND c.is_fulfilled = false
      ORDER BY c.created_at DESC
    `;
    res.json({ cravings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cravings for cook' });
  }
});

// ── POST /api/cravings  (add a craving) ─────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { menu_item_id, cook_id, dish_title, dish_price, dish_photo, currency_code, notes, is_public } = req.body;
    if (!dish_title) return res.status(400).json({ error: 'dish_title is required' });

    const craving = await sql`
      INSERT INTO cravings (user_id, menu_item_id, cook_id, dish_title, dish_price, dish_photo, currency_code, notes, is_public)
      VALUES (
        ${req.user.id},
        ${menu_item_id ?? null},
        ${cook_id ?? null},
        ${dish_title},
        ${dish_price ?? null},
        ${dish_photo ?? null},
        ${currency_code ?? 'NGN'},
        ${notes ?? null},
        ${is_public !== false}
      )
      ON CONFLICT (user_id, menu_item_id) DO UPDATE SET
        dish_title    = EXCLUDED.dish_title,
        dish_price    = EXCLUDED.dish_price,
        dish_photo    = EXCLUDED.dish_photo,
        notes         = EXCLUDED.notes,
        is_public     = EXCLUDED.is_public,
        created_at    = NOW()
      RETURNING *
    `;
    res.status(201).json({ craving: craving[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add craving' });
  }
});

// ── POST /api/cravings/:id/fulfill  (gift/fulfill someone's craving) ─────────
router.post('/:id/fulfill', authenticate, async (req, res) => {
  try {
    const craving = await sql`SELECT * FROM cravings WHERE id = ${req.params.id}`;
    if (!craving.length) return res.status(404).json({ error: 'Craving not found' });
    if (craving[0].is_fulfilled) return res.status(400).json({ error: 'Already fulfilled' });
    if (craving[0].user_id === req.user.id) return res.status(400).json({ error: 'Cannot fulfill your own craving' });

    const updated = await sql`
      UPDATE cravings SET
        is_fulfilled = true,
        fulfilled_by = ${req.user.id},
        fulfilled_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // Notify the craving owner
    const giver = await sql`SELECT full_name FROM users WHERE id = ${req.user.id}`;
    await sql`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        ${craving[0].user_id}, 'craving_fulfilled',
        ${(giver[0]?.full_name ?? 'Someone') + ' gifted your craving!'},
        ${'Your craving for ' + craving[0].dish_title + ' has been fulfilled!'},
        ${{ craving_id: req.params.id, fulfilled_by: req.user.id }}::jsonb
      )
    `;

    res.json({ craving: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fulfill craving' });
  }
});

// ── DELETE /api/cravings/:id ────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await sql`DELETE FROM cravings WHERE id = ${req.params.id} AND user_id = ${req.user.id}`;
    res.json({ message: 'Craving removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove craving' });
  }
});

// ── PATCH /api/cravings/:id/visibility ──────────────────────────────────────
router.patch('/:id/visibility', authenticate, async (req, res) => {
  try {
    const { is_public } = req.body;
    const updated = await sql`
      UPDATE cravings SET is_public = ${!!is_public}
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING *
    `;
    if (!updated.length) return res.status(404).json({ error: 'Craving not found' });
    res.json({ craving: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});

// ── PATCH /api/cravings/:id/cook-notify  (cook toggles notify-me flag) ──────
router.patch('/:id/cook-notify', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const craving = await sql`SELECT * FROM cravings WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}`;
    if (!craving.length) return res.status(404).json({ error: 'Craving not found' });

    const { notify } = req.body;
    const updated = await sql`
      UPDATE cravings SET cook_notify = ${!!notify} WHERE id = ${req.params.id} RETURNING *
    `;

    // If toggling on, notify the craving owner
    if (notify) {
      const cookInfo = await sql`SELECT display_name FROM cook_profiles WHERE id = ${cooks[0].id}`;
      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          ${craving[0].user_id}, 'cook_notify',
          ${(cookInfo[0]?.display_name ?? 'A cook') + ' is making your craving soon!'},
          ${'Your craving for ' + craving[0].dish_title + ' will be available soon. Stay tuned!'},
          ${{ craving_id: req.params.id, cook_id: cooks[0].id }}::jsonb
        )
      `;
    }

    res.json({ craving: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cook notify' });
  }
});

module.exports = router;
