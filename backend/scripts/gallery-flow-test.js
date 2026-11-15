// End-to-end test of the creator Gallery (migration 073) against a running server.
//
//   cd backend && PORT=5055 node server.js           # in one shell
//   cd backend && node scripts/gallery-flow-test.js  # in another (GALLERY_TEST_BASE to override)
//
// Uses existing dev-db cooks/customers, creates gallery rows and deletes every
// one it made in `finally`. Refuses to run against production.
require('dotenv').config();
const { assertNotProduction } = require('./lib/assert-not-production');
assertNotProduction('gallery-flow-test');
const jwt = require('jsonwebtoken');
const { sql } = require('../supabase/db');

const BASE = process.env.GALLERY_TEST_BASE || 'http://localhost:5055/api';
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const img = (n) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1/gallery-test/${Date.now()}-${n}.jpg`;
const tok = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '10m' });

async function call(method, path, userId, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers.Authorization = `Bearer ${tok(userId)}`;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = null; }
  return { status: r.status, body: json };
}
let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && extra ? '  — ' + extra : ''}`);
}

const PUBLIC_PHOTO_KEYS = ['id', 'source', 'url', 'album_id', 'menu_item_id', 'title', 'price', 'price_is_guide', 'currency_code'];
const PUBLIC_ALBUM_KEYS = ['id', 'name', 'cover_url', 'photo_count'];
let cookA, tempAdminId;
const createdAlbums = [];

(async () => {
  try {
    if (!CLOUD) throw new Error('CLOUDINARY_CLOUD_NAME not set');
    [cookA] = await sql`
      SELECT u.id AS user_id, cp.id AS cook_id, COALESCE(cp.currency_code, 'NGN') AS currency,
             (SELECT mi.id FROM menu_items mi WHERE mi.cook_id = cp.id AND mi.is_active ORDER BY mi.created_at DESC LIMIT 1) AS dish_id
      FROM users u JOIN cook_profiles cp ON cp.user_id = u.id
      WHERE u.role = 'cook' AND u.is_active
        AND EXISTS (SELECT 1 FROM menu_items mi WHERE mi.cook_id = cp.id AND mi.is_active)
      LIMIT 1`;
    const [cookB] = await sql`
      SELECT u.id AS user_id, cp.id AS cook_id FROM users u JOIN cook_profiles cp ON cp.user_id = u.id
      WHERE u.role = 'cook' AND u.is_active AND cp.id <> ${cookA?.cook_id ?? null} LIMIT 1`;
    const [cust] = await sql`SELECT id FROM users WHERE role = 'customer' AND is_active LIMIT 1`;
    // A throwaway admin, deleted in finally.
    const [admin] = await sql`INSERT INTO users (role, full_name) VALUES ('admin', 'Gallery test admin') RETURNING id`;
    tempAdminId = admin.id;
    if (!cookA || !cookB || !cust) throw new Error('need a cook with an active dish, a second cook and a customer in the dev db');
    const [dish] = await sql`SELECT unit_price, currency_code FROM menu_items WHERE id = ${cookA.dish_id}`;
    const [otherDish] = await sql`SELECT id FROM menu_items WHERE cook_id <> ${cookA.cook_id} LIMIT 1`;

    // ── Adding ──
    let r = await call('POST', '/gallery/me/photos', cookA.user_id, { urls: ['https://evil.example/x.jpg'] });
    check('rejects a URL that was not uploaded through us', r.status === 400);
    r = await call('POST', '/gallery/me/photos', cust.id, { urls: [img(0)] });
    check('a customer cannot add gallery photos', r.status === 403);
    if (otherDish) {
      r = await call('POST', '/gallery/me/photos', cookA.user_id, { urls: [img(0)], menu_item_id: otherDish.id });
      check("cannot link another creator's dish", r.status === 400);
    } else {
      console.log("SKIP  cannot link another creator's dish: only one creator has dishes in the dev db");
    }
    r = await call('POST', '/gallery/me/photos', cookA.user_id, { urls: [img(0)], guide_price: -5 });
    check('rejects a negative guide price', r.status === 400);

    r = await call('POST', '/gallery/me/photos', cookA.user_id, { urls: [{ url: img(1) }, { url: img(2) }], album_name: '  Ada wedding  ' });
    check('adds two photos as a new album', r.status === 201 && r.body.album_id && r.body.photos.length === 2, JSON.stringify(r.body));
    const albumId = r.body.album_id;
    if (albumId) createdAlbums.push(albumId);
    const [p1, p2] = r.body.photos.map((p) => p.id);
    r = await call('POST', '/gallery/me/photos', cookA.user_id, { urls: [img(3)], guide_price: '85000' });
    check('adds a loose photo with a guide price', r.status === 201 && r.body.album_id === null);
    const p3 = r.body.photos[0].id;
    r = await call('POST', '/gallery/me/photos', cookA.user_id, { urls: [img(4)], menu_item_id: cookA.dish_id });
    check('adds a photo linked to own dish', r.status === 201);
    const p4 = r.body.photos[0].id;

    // ── Public read ──
    r = await call('GET', `/gallery/cook/${cookA.cook_id}`);
    check('public gallery loads without signing in', r.status === 200);
    const album = r.body.albums.find((a) => a.id === albumId);
    check('album shows trimmed name and 2 photos', album?.name === 'Ada wedding' && album?.photo_count === 2, JSON.stringify(album));
    check('album has a cover', !!album?.cover_url);
    const byId = Object.fromEntries(r.body.photos.map((p) => [p.id, p]));
    check('album photos also appear in the grid', byId[p1]?.album_id === albumId && !!byId[p2]);
    check('guide price shown in the creator currency', byId[p3]?.price === 85000 && byId[p3]?.price_is_guide === true && byId[p3]?.currency_code === cookA.currency,
      JSON.stringify(byId[p3]));
    check('linked dish shows its live price', byId[p4]?.price === Number(dish.unit_price) && byId[p4]?.menu_item_id === cookA.dish_id && byId[p4]?.price_is_guide === false,
      JSON.stringify(byId[p4]));
    check('active dish photos are included automatically', r.body.photos.some((p) => p.source === 'dish'));
    check('public photos carry only whitelisted fields', r.body.photos.every((p) => Object.keys(p).every((k) => PUBLIC_PHOTO_KEYS.includes(k))));
    check('public albums carry only whitelisted fields', r.body.albums.every((a) => Object.keys(a).every((k) => PUBLIC_ALBUM_KEYS.includes(k))));
    r = await call('GET', '/gallery/cook/not-a-uuid');
    check('bad creator id is a 404, not a 500', r.status === 404);

    // ── Ownership ──
    r = await call('PATCH', `/gallery/me/photos/${p3}`, cookB.user_id, { guide_price: 1 });
    check("another creator cannot edit the photo", r.status === 404);
    r = await call('DELETE', `/gallery/me/photos/${p3}`, cookB.user_id);
    check("another creator cannot delete the photo", r.status === 404);
    r = await call('DELETE', `/gallery/me/albums/${albumId}`, cookB.user_id);
    check("another creator cannot delete the album", r.status === 404);

    // ── Editing ──
    r = await call('PATCH', `/gallery/me/photos/${p3}`, cookA.user_id, { guide_price: 'abc' });
    check('rejects a non-numeric guide price', r.status === 400);
    r = await call('PATCH', `/gallery/me/photos/${p3}`, cookA.user_id, { guide_price: 90000, album_id: albumId });
    check('edits price and moves a photo into the album', r.status === 200 && Number(r.body.photo.guide_price) === 90000 && r.body.photo.album_id === albumId);
    r = await call('PATCH', `/gallery/me/photos/${p4}`, cookA.user_id, { album_name: 'Birthday' });
    const newAlbum = r.body?.photo?.album_id;
    if (newAlbum) createdAlbums.push(newAlbum);
    check('editing a photo can start a new album', r.status === 200 && !!newAlbum && newAlbum !== albumId);
    r = await call('PATCH', `/gallery/me/photos/${p4}`, cookA.user_id, { album_id: null });
    check('a photo can be taken out of its album', r.status === 200 && r.body.photo.album_id === null);
    r = await call('PATCH', `/gallery/me/albums/${albumId}`, cookA.user_id, { name: 'Ada & Tunde wedding' });
    check('renames the album', r.status === 200 && r.body.album.name === 'Ada & Tunde wedding');

    // ── Reorder ──
    r = await call('PUT', '/gallery/me/order', cookA.user_id, { photo_ids: [p3, p1] });
    check('reorder accepted', r.status === 200);
    r = await call('GET', '/gallery/me', cookA.user_id);
    const order = r.body.photos.map((p) => p.id);
    check('reordered photos lead, the rest follow', order[0] === p3 && order[1] === p1 && order.includes(p2) && order.includes(p4), order.join(','));

    // ── Reports + moderation ──
    r = await call('POST', '/gallery/report', cust.id, { album_id: albumId, reason: 'Not their food' });
    check('a customer can report an album', r.status === 201);
    r = await call('POST', '/gallery/report', cust.id, { album_id: albumId, reason: 'again' });
    const [{ n: openReports }] = await sql`SELECT count(*)::int AS n FROM gallery_reports WHERE album_id = ${albumId} AND resolved_at IS NULL`;
    check('a second report by the same person is not duplicated', r.status === 201 && openReports === 1, `open=${openReports}`);
    r = await call('POST', '/gallery/report', cookA.user_id, { album_id: albumId, reason: 'x' });
    check('a creator cannot report their own album', r.status === 404);
    r = await call('POST', '/gallery/report', cust.id, { photo_id: p4, reason: 'Stolen photo' });
    check('a customer can report a photo', r.status === 201);

    if (admin) {
      r = await call('GET', '/admin/moderation', admin.id);
      const item = r.body?.gallery_reports?.find((g) => g.id === albumId);
      check('the album appears in the admin moderation queue', item?.entity_type === 'gallery_album' && item?.report_count === 1,
        `status ${r.status}, keys ${Object.keys(r.body ?? {})}, gallery_reports ${JSON.stringify(r.body?.gallery_reports)?.slice(0, 300)}`);
      r = await call('PATCH', `/admin/moderation/gallery/album/${albumId}/hide`, cust.id);
      check('a non-admin cannot hide', r.status === 403);
      r = await call('PATCH', `/admin/moderation/gallery/album/${albumId}/hide`, admin.id);
      check('admin hides the album', r.status === 200);
      r = await call('GET', `/gallery/cook/${cookA.cook_id}`);
      check('hidden album is gone from the public profile', !r.body.albums.some((a) => a.id === albumId));
      check("hidden album's photos are gone from the public grid", !r.body.photos.some((p) => [p1, p2, p3].includes(p.id)));
      r = await call('GET', '/gallery/me', cookA.user_id);
      check('the creator still sees it, marked hidden', r.body.albums.find((a) => a.id === albumId)?.is_hidden === true);
      const [{ n: stillOpen }] = await sql`SELECT count(*)::int AS n FROM gallery_reports WHERE album_id = ${albumId} AND resolved_at IS NULL`;
      check('hiding closes the reports', stillOpen === 0);
      r = await call('PATCH', `/admin/moderation/gallery/photo/${p4}/dismiss`, admin.id);
      const [{ n: photoOpen }] = await sql`SELECT count(*)::int AS n FROM gallery_reports WHERE photo_id = ${p4} AND resolved_at IS NULL`;
      check('dismiss closes the photo report and keeps the photo', r.status === 200 && photoOpen === 0);
      r = await call('PATCH', `/admin/moderation/gallery/album/${albumId}/unhide`, admin.id);
      check('admin can unhide', r.status === 200);
    } else {
      console.log('SKIP  admin moderation: no admin user in the dev db');
    }

    // ── Deleting ──
    r = await call('DELETE', `/gallery/me/albums/${albumId}`, cookA.user_id);
    check('deletes the album', r.status === 200);
    const left = await sql`SELECT id, album_id FROM gallery_photos WHERE id = ANY(${[p1, p2, p3]}::uuid[])`;
    check("the album's photos stay as loose photos", left.length === 3 && left.every((p) => p.album_id === null));
    r = await call('DELETE', `/gallery/me/photos/${p1}`, cookA.user_id);
    check('deletes a photo', r.status === 200);
  } catch (e) {
    fail++;
    console.error('ERROR', e);
  } finally {
    if (cookA) {
      await sql`DELETE FROM gallery_photos WHERE cook_id = ${cookA.cook_id} AND url LIKE ${'%/gallery-test/%'}`;
      if (createdAlbums.length) await sql`DELETE FROM gallery_albums WHERE id = ANY(${createdAlbums}::uuid[])`;
    }
    if (tempAdminId) {
      await sql`DELETE FROM admin_actions WHERE admin_user_id = ${tempAdminId}`;
      await sql`DELETE FROM users WHERE id = ${tempAdminId}`;
    }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exitCode = fail ? 1 : 0;
    await sql.end?.({ timeout: 2 }).catch?.(() => {});
  }
})();
