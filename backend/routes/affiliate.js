const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/affiliate/my — cook's links ──────────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.json({ links: [] });
    const links = await sql`
      SELECT * FROM affiliate_links WHERE cook_id = ${cooks[0].id} ORDER BY created_at DESC
    `;
    res.json({ links });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch affiliate links' });
  }
});

// ── POST /api/affiliate — create link ─────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { url, title, description, commission_rate, expires_at } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    // Generate a short unique code
    const code = `${cooks[0].id.slice(0,4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const [link] = await sql`
      INSERT INTO affiliate_links (cook_id, code, url, title, description, commission_rate, expires_at)
      VALUES (
        ${cooks[0].id}, ${code}, ${url},
        ${title ?? null}, ${description ?? null},
        ${commission_rate ?? 0},
        ${expires_at ?? null}::date
      ) RETURNING *
    `;
    res.status(201).json({ link });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create affiliate link' });
  }
});

// ── GET /api/affiliate/track/:code — click tracking (public) ─────────────────
router.get('/track/:code', async (req, res) => {
  try {
    const links = await sql`
      SELECT * FROM affiliate_links WHERE code = ${req.params.code} AND is_active = true
    `;
    if (!links.length) return res.status(404).json({ error: 'Link not found' });

    await sql`
      UPDATE affiliate_links SET click_count = click_count + 1 WHERE code = ${req.params.code}
    `;
    // Redirect to destination URL
    res.redirect(links[0].url);
  } catch (err) {
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// ── PATCH /api/affiliate/:id ──────────────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const f = req.body;
    const [link] = await sql`
      UPDATE affiliate_links SET
        title           = COALESCE(${f.title ?? null}, title),
        description     = COALESCE(${f.description ?? null}, description),
        commission_rate = COALESCE(${f.commission_rate ?? null}, commission_rate),
        is_active       = COALESCE(${f.is_active ?? null}, is_active),
        expires_at      = COALESCE(${f.expires_at ?? null}::date, expires_at)
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!link) return res.status(404).json({ error: 'Link not found' });
    res.json({ link });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update link' });
  }
});

// ── DELETE /api/affiliate/:id ─────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    await sql`DELETE FROM affiliate_links WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

module.exports = router;
