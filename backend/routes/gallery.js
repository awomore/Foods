const express = require('express');
const router = express.Router();
const { sql } = require('../supabase/db');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Creator Gallery (migration 073). Public reads select only the columns they
// name, never cp.* or u.*, so nothing private on the profile row can leak
// through here (see the /api/cooks leak fixed in b94c895).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTOS_PER_CREATOR = 300;
const MAX_PHOTOS_PER_REQUEST = 30;
const MAX_ALBUMS_PER_CREATOR = 50;

function isOurUpload(url) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (typeof url !== 'string' || !cloud) return false;
  return url.startsWith(`https://res.cloudinary.com/${cloud}/`);
}

async function myCookId(req) {
  const rows = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`;
  return rows[0]?.id ?? null;
}

/** null / '' clears it; otherwise a positive number with at most 2 decimals, or undefined when invalid. */
function parseGuidePrice(v) {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 1e12) return undefined;
  return Math.round(n * 100) / 100;
}

/** The menu item must belong to this creator. Returns true, false, or null when none given. */
async function ownsDish(cookId, menuItemId) {
  if (menuItemId == null) return null;
  if (!UUID_RE.test(String(menuItemId))) return false;
  const rows = await sql`SELECT 1 FROM menu_items WHERE id = ${menuItemId} AND cook_id = ${cookId}`;
  return rows.length > 0;
}

// Photos of the creator's active dishes, shown in the gallery without being stored.
// Skips a dish whose first photo the creator already added themselves.
function dishPhotos(cookId) {
  return sql`
    SELECT mi.id AS menu_item_id, mi.title, mi.photos[1] AS url,
           mi.unit_price AS price, mi.currency_code
    FROM menu_items mi
    WHERE mi.cook_id = ${cookId}
      AND mi.is_active = true
      AND cardinality(mi.photos) > 0
      AND NOT EXISTS (SELECT 1 FROM gallery_photos gp WHERE gp.cook_id = mi.cook_id AND gp.url = mi.photos[1])
    ORDER BY mi.created_at DESC
    LIMIT 100
  `;
}

// ── GET /api/gallery/cook/:cookId — public gallery ───────────────────────────
router.get('/cook/:cookId', optionalAuth, async (req, res) => {
  try {
    const { cookId } = req.params;
    if (!UUID_RE.test(cookId)) return res.status(404).json({ error: 'Creator not found' });
    const cooks = await sql`SELECT id, COALESCE(currency_code, 'NGN') AS currency_code FROM cook_profiles WHERE id = ${cookId}`;
    if (!cooks.length) return res.status(404).json({ error: 'Creator not found' });
    const cookCurrency = cooks[0].currency_code;

    const [albums, photos, dishes] = await Promise.all([
      sql`
        SELECT a.id, a.name,
               (SELECT gp.url FROM gallery_photos gp
                 WHERE gp.album_id = a.id AND gp.is_hidden = false
                 ORDER BY gp.sort_order, gp.created_at DESC LIMIT 1) AS cover_url,
               (SELECT count(*) FROM gallery_photos gp
                 WHERE gp.album_id = a.id AND gp.is_hidden = false)::int AS photo_count
        FROM gallery_albums a
        WHERE a.cook_id = ${cookId} AND a.is_hidden = false
        ORDER BY a.sort_order, a.created_at DESC
      `,
      sql`
        SELECT gp.id, gp.url, gp.album_id, gp.guide_price,
               mi.id AS menu_item_id, mi.title AS dish_title,
               mi.unit_price AS dish_price, mi.currency_code AS dish_currency
        FROM gallery_photos gp
        LEFT JOIN gallery_albums a ON a.id = gp.album_id
        LEFT JOIN menu_items mi ON mi.id = gp.menu_item_id AND mi.is_active = true
        WHERE gp.cook_id = ${cookId} AND gp.is_hidden = false
          AND (gp.album_id IS NULL OR a.is_hidden = false)
        ORDER BY gp.sort_order, gp.created_at DESC
      `,
      dishPhotos(cookId),
    ]);

    const items = [
      ...photos.map((p) => ({
        id: p.id,
        source: 'gallery',
        url: p.url,
        album_id: p.album_id,
        menu_item_id: p.menu_item_id,
        title: p.dish_title,
        // A live dish wins; an unavailable linked dish falls back to the guide price.
        price: p.menu_item_id ? Number(p.dish_price) : p.guide_price != null ? Number(p.guide_price) : null,
        price_is_guide: !p.menu_item_id && p.guide_price != null,
        currency_code: p.menu_item_id ? p.dish_currency : cookCurrency,
      })),
      ...dishes.map((d) => ({
        id: `dish:${d.menu_item_id}`,
        source: 'dish',
        url: d.url,
        album_id: null,
        menu_item_id: d.menu_item_id,
        title: d.title,
        price: Number(d.price),
        price_is_guide: false,
        currency_code: d.currency_code,
      })),
    ];

    res.json({ albums: albums.filter((a) => a.photo_count > 0), photos: items });
  } catch (err) {
    console.error('GET /gallery/cook/:cookId:', err);
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

// ── GET /api/gallery/me — the creator's own gallery, hidden items included ───
router.get('/me', authenticate, async (req, res) => {
  try {
    const cookId = await myCookId(req);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });
    const [albums, photos, dishes, cur] = await Promise.all([
      sql`
        SELECT a.id, a.name, a.is_hidden,
               (SELECT count(*) FROM gallery_photos gp WHERE gp.album_id = a.id)::int AS photo_count
        FROM gallery_albums a WHERE a.cook_id = ${cookId}
        ORDER BY a.sort_order, a.created_at DESC
      `,
      sql`
        SELECT gp.id, gp.url, gp.album_id, gp.menu_item_id, gp.guide_price, gp.is_hidden,
               mi.title AS dish_title, mi.unit_price AS dish_price, mi.currency_code AS dish_currency,
               mi.is_active AS dish_active
        FROM gallery_photos gp
        LEFT JOIN menu_items mi ON mi.id = gp.menu_item_id
        WHERE gp.cook_id = ${cookId}
        ORDER BY gp.sort_order, gp.created_at DESC
      `,
      dishPhotos(cookId),
      sql`SELECT COALESCE(currency_code, 'NGN') AS c FROM cook_profiles WHERE id = ${cookId}`,
    ]);
    res.json({
      currency_code: cur[0].c,
      albums,
      photos: photos.map((p) => ({ ...p, guide_price: p.guide_price != null ? Number(p.guide_price) : null, dish_price: p.dish_price != null ? Number(p.dish_price) : null })),
      dish_photos: dishes.map((d) => ({ ...d, price: Number(d.price) })),
      limits: { max_photos: MAX_PHOTOS_PER_CREATOR, max_per_upload: MAX_PHOTOS_PER_REQUEST },
    });
  } catch (err) {
    console.error('GET /gallery/me:', err);
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

// ── POST /api/gallery/me/photos — add uploaded photos ────────────────────────
// body: { urls: [{ url, public_id? }], album_name?, album_id?, menu_item_id?, guide_price? }
router.post('/me/photos', authenticate, async (req, res) => {
  try {
    const cookId = await myCookId(req);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });

    const { urls, album_name, album_id, menu_item_id } = req.body ?? {};
    if (!Array.isArray(urls) || urls.length === 0) return res.status(400).json({ error: 'urls required' });
    if (urls.length > MAX_PHOTOS_PER_REQUEST) return res.status(400).json({ error: `At most ${MAX_PHOTOS_PER_REQUEST} photos at a time` });
    const clean = urls.map((u) => (typeof u === 'string' ? { url: u } : u));
    if (!clean.every((u) => u && isOurUpload(u.url))) {
      return res.status(400).json({ error: 'Photos must be uploaded through the app' });
    }

    const guide = req.body?.guide_price === undefined ? null : parseGuidePrice(req.body.guide_price);
    if (guide === undefined) return res.status(400).json({ error: 'Invalid guide price' });
    if ((await ownsDish(cookId, menu_item_id ?? null)) === false) {
      return res.status(400).json({ error: 'That dish is not on your menu' });
    }

    const [{ n }] = await sql`SELECT count(*)::int AS n FROM gallery_photos WHERE cook_id = ${cookId}`;
    if (n + clean.length > MAX_PHOTOS_PER_CREATOR) {
      return res.status(400).json({ error: `Your gallery holds up to ${MAX_PHOTOS_PER_CREATOR} photos`, code: 'GALLERY_FULL' });
    }

    const result = await sql.begin(async (tx) => {
      let albumId = null;
      if (album_id) {
        if (!UUID_RE.test(String(album_id))) throw Object.assign(new Error('bad album'), { status: 400 });
        const a = await tx`SELECT id FROM gallery_albums WHERE id = ${album_id} AND cook_id = ${cookId}`;
        if (!a.length) throw Object.assign(new Error('Album not found'), { status: 404 });
        albumId = a[0].id;
      } else if (typeof album_name === 'string' && album_name.trim()) {
        const name = album_name.trim().slice(0, 80);
        const [{ c }] = await tx`SELECT count(*)::int AS c FROM gallery_albums WHERE cook_id = ${cookId}`;
        if (c >= MAX_ALBUMS_PER_CREATOR) throw Object.assign(new Error(`Up to ${MAX_ALBUMS_PER_CREATOR} albums`), { status: 400 });
        const [a] = await tx`
          INSERT INTO gallery_albums (cook_id, name, sort_order)
          VALUES (${cookId}, ${name}, (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM gallery_albums WHERE cook_id = ${cookId}))
          RETURNING id`;
        albumId = a.id;
      }

      // New photos go first, in the order picked.
      const [{ first }] = await tx`SELECT COALESCE(MIN(sort_order), 0) AS first FROM gallery_photos WHERE cook_id = ${cookId}`;
      const base = Number(first) - clean.length;
      const inserted = [];
      for (let i = 0; i < clean.length; i++) {
        const [p] = await tx`
          INSERT INTO gallery_photos (cook_id, album_id, url, public_id, menu_item_id, guide_price, sort_order)
          VALUES (${cookId}, ${albumId}, ${clean[i].url}, ${clean[i].public_id ?? null},
                  ${menu_item_id ?? null}, ${guide}, ${base + i})
          RETURNING id, url, album_id, menu_item_id, guide_price`;
        inserted.push(p);
      }
      return { album_id: albumId, photos: inserted };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('POST /gallery/me/photos:', err);
    res.status(500).json({ error: 'Failed to add photos' });
  }
});

// ── PATCH /api/gallery/me/photos/:id — price, dish link, album ───────────────
router.patch('/me/photos/:id', authenticate, async (req, res) => {
  try {
    const cookId = await myCookId(req);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Photo not found' });
    const [photo] = await sql`SELECT id, menu_item_id, guide_price, album_id FROM gallery_photos WHERE id = ${req.params.id} AND cook_id = ${cookId}`;
    if (!photo) return res.status(404).json({ error: 'Photo not found' });

    const body = req.body ?? {};
    let { menu_item_id, guide_price, album_id } = photo;
    if ('menu_item_id' in body) {
      if ((await ownsDish(cookId, body.menu_item_id)) === false) return res.status(400).json({ error: 'That dish is not on your menu' });
      menu_item_id = body.menu_item_id ?? null;
    }
    if ('guide_price' in body) {
      const g = parseGuidePrice(body.guide_price);
      if (g === undefined) return res.status(400).json({ error: 'Invalid guide price' });
      guide_price = g;
    }
    if (typeof body.album_name === 'string' && body.album_name.trim()) {
      const [{ c }] = await sql`SELECT count(*)::int AS c FROM gallery_albums WHERE cook_id = ${cookId}`;
      if (c >= MAX_ALBUMS_PER_CREATOR) return res.status(400).json({ error: `Up to ${MAX_ALBUMS_PER_CREATOR} albums` });
      const [a] = await sql`
        INSERT INTO gallery_albums (cook_id, name, sort_order)
        VALUES (${cookId}, ${body.album_name.trim().slice(0, 80)},
                (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM gallery_albums WHERE cook_id = ${cookId}))
        RETURNING id`;
      album_id = a.id;
    } else if ('album_id' in body) {
      if (body.album_id != null) {
        if (!UUID_RE.test(String(body.album_id))) return res.status(404).json({ error: 'Album not found' });
        const a = await sql`SELECT id FROM gallery_albums WHERE id = ${body.album_id} AND cook_id = ${cookId}`;
        if (!a.length) return res.status(404).json({ error: 'Album not found' });
      }
      album_id = body.album_id ?? null;
    }

    const [updated] = await sql`
      UPDATE gallery_photos SET menu_item_id = ${menu_item_id}, guide_price = ${guide_price}, album_id = ${album_id}
      WHERE id = ${photo.id}
      RETURNING id, url, album_id, menu_item_id, guide_price`;
    res.json({ photo: updated });
  } catch (err) {
    console.error('PATCH /gallery/me/photos/:id:', err);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// ── DELETE /api/gallery/me/photos/:id ────────────────────────────────────────
router.delete('/me/photos/:id', authenticate, async (req, res) => {
  try {
    const cookId = await myCookId(req);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Photo not found' });
    const del = await sql`DELETE FROM gallery_photos WHERE id = ${req.params.id} AND cook_id = ${cookId} RETURNING id`;
    if (!del.length) return res.status(404).json({ error: 'Photo not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /gallery/me/photos/:id:', err);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// ── PUT /api/gallery/me/order — reorder photos ───────────────────────────────
// body: { photo_ids: [...] } in display order; ids not listed keep their place after them.
router.put('/me/order', authenticate, async (req, res) => {
  try {
    const cookId = await myCookId(req);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });
    const ids = req.body?.photo_ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_PHOTOS_PER_CREATOR || !ids.every((i) => UUID_RE.test(String(i)))) {
      return res.status(400).json({ error: 'photo_ids required' });
    }
    // Renumber the whole gallery in one statement: listed photos first in the
    // given order, the rest after them in their current order.
    await sql`
      UPDATE gallery_photos g SET sort_order = r.rn
      FROM (
        SELECT gp.id,
               row_number() OVER (ORDER BY o.ord NULLS LAST, gp.sort_order, gp.created_at DESC)::int AS rn
        FROM gallery_photos gp
        LEFT JOIN unnest(${ids}::uuid[]) WITH ORDINALITY AS o(id, ord) ON o.id = gp.id
        WHERE gp.cook_id = ${cookId}
      ) r
      WHERE g.id = r.id`;
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /gallery/me/order:', err);
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

// ── PATCH /api/gallery/me/albums/:id — rename ────────────────────────────────
router.patch('/me/albums/:id', authenticate, async (req, res) => {
  try {
    const cookId = await myCookId(req);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Album not found' });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
    if (!name) return res.status(400).json({ error: 'name required' });
    const [a] = await sql`
      UPDATE gallery_albums SET name = ${name}, updated_at = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cookId}
      RETURNING id, name`;
    if (!a) return res.status(404).json({ error: 'Album not found' });
    res.json({ album: a });
  } catch (err) {
    console.error('PATCH /gallery/me/albums/:id:', err);
    res.status(500).json({ error: 'Failed to rename album' });
  }
});

// ── DELETE /api/gallery/me/albums/:id — photos stay as loose gallery photos ──
router.delete('/me/albums/:id', authenticate, async (req, res) => {
  try {
    const cookId = await myCookId(req);
    if (!cookId) return res.status(403).json({ error: 'Cook profile required' });
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Album not found' });
    const del = await sql`DELETE FROM gallery_albums WHERE id = ${req.params.id} AND cook_id = ${cookId} RETURNING id`;
    if (!del.length) return res.status(404).json({ error: 'Album not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /gallery/me/albums/:id:', err);
    res.status(500).json({ error: 'Failed to delete album' });
  }
});

// ── POST /api/gallery/report — { album_id | photo_id, reason } ───────────────
router.post('/report', authenticate, async (req, res) => {
  try {
    const { album_id, photo_id } = req.body ?? {};
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (!reason) return res.status(400).json({ error: 'reason required' });
    if (!!album_id === !!photo_id) return res.status(400).json({ error: 'album_id or photo_id required' });
    const id = album_id ?? photo_id;
    if (!UUID_RE.test(String(id))) return res.status(404).json({ error: 'Not found' });

    const target = album_id
      ? await sql`SELECT a.id FROM gallery_albums a JOIN cook_profiles cp ON cp.id = a.cook_id WHERE a.id = ${id} AND cp.user_id <> ${req.user.id}`
      : await sql`SELECT p.id FROM gallery_photos p JOIN cook_profiles cp ON cp.id = p.cook_id WHERE p.id = ${id} AND cp.user_id <> ${req.user.id}`;
    if (!target.length) return res.status(404).json({ error: 'Not found' });

    await sql`
      INSERT INTO gallery_reports (reporter_id, album_id, photo_id, reason)
      VALUES (${req.user.id}, ${album_id ?? null}, ${photo_id ?? null}, ${reason})
      ON CONFLICT DO NOTHING`;
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /gallery/report:', err);
    res.status(500).json({ error: 'Failed to report' });
  }
});

module.exports = router;
