const express = require('express');
const router  = express.Router();
const { sql } = require('../supabase/db');
const { authenticate } = require('../middleware/auth');
const { notifyAndPush } = require('../services/push');

// POST /api/notify-available/:menu_item_id  — register interest
router.post('/:menu_item_id', authenticate, async (req, res) => {
  try {
    const { menu_item_id } = req.params;
    const userId = req.user.id;

    const [item] = await sql`SELECT id, title FROM menu_items WHERE id = ${menu_item_id} LIMIT 1`;
    if (!item) return res.status(404).json({ error: 'Dish not found' });

    await sql`
      INSERT INTO notify_when_available (user_id, menu_item_id)
      VALUES (${userId}, ${menu_item_id})
      ON CONFLICT (user_id, menu_item_id) DO NOTHING
    `;

    res.json({ registered: true, title: item.title });
  } catch (err) {
    console.error('POST /notify-available:', err);
    res.status(500).json({ error: 'Could not register notification' });
  }
});

// DELETE /api/notify-available/:menu_item_id  — cancel interest
router.delete('/:menu_item_id', authenticate, async (req, res) => {
  try {
    await sql`
      DELETE FROM notify_when_available
      WHERE user_id = ${req.user.id} AND menu_item_id = ${req.params.menu_item_id}
    `;
    res.json({ removed: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not remove notification' });
  }
});

// GET /api/notify-available/check/:menu_item_id  — check if user is registered
router.get('/check/:menu_item_id', authenticate, async (req, res) => {
  try {
    const [row] = await sql`
      SELECT id FROM notify_when_available
      WHERE user_id = ${req.user.id} AND menu_item_id = ${req.params.menu_item_id} AND notified_at IS NULL
    `;
    res.json({ watching: !!row });
  } catch (err) {
    res.status(500).json({ error: 'Check failed' });
  }
});

// Internal: called when a menu item is restocked (slots > 0)
// Triggered from menu.js when available_from is set or slots are added
async function notifyWatchers(menuItemId) {
  try {
    const watchers = await sql`
      SELECT nwa.user_id, mi.title AS dish_title
      FROM notify_when_available nwa
      JOIN menu_items mi ON mi.id = nwa.menu_item_id
      WHERE nwa.menu_item_id = ${menuItemId} AND nwa.notified_at IS NULL
    `;
    if (!watchers.length) return;

    const dishTitle = watchers[0].dish_title;
    for (const { user_id } of watchers) {
      await notifyAndPush(
        user_id,
        'dish_available',
        'Your dish is back!',
        `"${dishTitle}" is available again — order now before it sells out.`,
        { menu_item_id: menuItemId, type: 'dish_available' }
      ).catch(() => {});
    }

    await sql`
      UPDATE notify_when_available
      SET notified_at = NOW()
      WHERE menu_item_id = ${menuItemId} AND notified_at IS NULL
    `;
  } catch (err) {
    console.error('notifyWatchers error:', err);
  }
}

module.exports = router;
module.exports.notifyWatchers = notifyWatchers;
