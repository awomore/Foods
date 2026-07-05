const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { notifyAndPush } = require('../services/push');
const { orchestrator } = require('../payments/orchestrator');

// ── GET /api/digital-products — public listing ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { cook_id, type, limit = 20, offset = 0 } = req.query;
    let products;

    if (cook_id) {
      products = await sql`
        SELECT dp.*, cp.display_name AS cook_name
        FROM digital_products dp JOIN cook_profiles cp ON cp.id = dp.cook_id
        WHERE dp.cook_id = ${cook_id} AND dp.is_published = true
        ORDER BY dp.download_count DESC LIMIT ${Math.min(+limit, 100)} OFFSET ${+offset}
      `;
    } else if (type) {
      products = await sql`
        SELECT dp.*, cp.display_name AS cook_name
        FROM digital_products dp JOIN cook_profiles cp ON cp.id = dp.cook_id
        WHERE dp.is_published = true AND dp.type = ${type}
        ORDER BY dp.download_count DESC LIMIT ${Math.min(+limit, 100)} OFFSET ${+offset}
      `;
    } else {
      products = await sql`
        SELECT dp.*, cp.display_name AS cook_name
        FROM digital_products dp JOIN cook_profiles cp ON cp.id = dp.cook_id
        WHERE dp.is_published = true
        ORDER BY dp.download_count DESC LIMIT ${Math.min(+limit, 100)} OFFSET ${+offset}
      `;
    }
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── GET /api/digital-products/my — cook's own products ───────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.json({ products: [] });
    const products = await sql`
      SELECT * FROM digital_products WHERE cook_id = ${cooks[0].id} ORDER BY created_at DESC
    `;
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// ── GET /api/digital-products/:id ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const rows = await sql`
      SELECT dp.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
      FROM digital_products dp JOIN cook_profiles cp ON cp.id = dp.cook_id
      WHERE dp.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    // Never expose file_url before purchase
    const p = { ...rows[0], file_url: undefined };
    res.json({ product: p });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ── POST /api/digital-products — create product ───────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { type, title, description, cover_image, file_url, preview_url, price, page_count, tags } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'type and title required' });

    const [product] = await sql`
      INSERT INTO digital_products (
        cook_id, type, title, description, cover_image, file_url, preview_url,
        price, page_count, tags
      ) VALUES (
        ${cooks[0].id}, ${type}, ${title},
        ${description ?? null}, ${cover_image ?? null},
        ${file_url ?? null}, ${preview_url ?? null},
        ${price ?? 0}, ${page_count ?? null},
        ${Array.isArray(tags) && tags.length ? tags : []}
      ) RETURNING *
    `;
    res.status(201).json({ product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// ── PATCH /api/digital-products/:id ──────────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const f = req.body;
    const [updated] = await sql`
      UPDATE digital_products SET
        type         = COALESCE(${f.type ?? null}, type),
        title        = COALESCE(${f.title ?? null}, title),
        description  = COALESCE(${f.description ?? null}, description),
        cover_image  = COALESCE(${f.cover_image ?? null}, cover_image),
        file_url     = COALESCE(${f.file_url ?? null}, file_url),
        preview_url  = COALESCE(${f.preview_url ?? null}, preview_url),
        price        = COALESCE(${f.price ?? null}, price),
        page_count   = COALESCE(${f.page_count ?? null}, page_count),
        is_published = COALESCE(${f.is_published ?? null}, is_published),
        updated_at   = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ── POST /api/digital-products/:id/purchase — buy product ────────────────────
router.post('/:id/purchase', authenticate, async (req, res) => {
  try {
    const { tx_ref, amount_paid } = req.body;
    const products = await sql`SELECT * FROM digital_products WHERE id = ${req.params.id} AND is_published = true`;
    if (!products.length) return res.status(404).json({ error: 'Product not found' });
    const product = products[0];

    // Require verified payment for paid products
    if (parseFloat(product.price ?? 0) > 0) {
      if (!tx_ref) return res.status(400).json({ error: 'tx_ref required for paid products' });
      const status = await orchestrator.verifyCharge({ reference: tx_ref });
      if (!status.devMode) {
        if (!status.successful) {
          return res.status(400).json({ error: 'Payment verification failed' });
        }
        if (parseFloat(status.amount) < parseFloat(product.price)) {
          return res.status(400).json({ error: 'Payment amount insufficient for this product' });
        }
      }
    }

    const [purchase] = await sql`
      INSERT INTO digital_product_purchases (product_id, user_id, tx_ref, amount_paid, download_url)
      VALUES (${req.params.id}, ${req.user.id}, ${tx_ref ?? null}, ${amount_paid ?? 0}, ${product.file_url})
      ON CONFLICT (product_id, user_id) DO UPDATE SET tx_ref = EXCLUDED.tx_ref
      RETURNING *
    `;

    await sql`UPDATE digital_products SET download_count = download_count + 1 WHERE id = ${req.params.id}`;

    // Notify the cook of the sale (fire-and-forget)
    ;(async () => {
      try {
        const [cookUser] = await sql`
          SELECT u.id AS user_id, u.full_name AS buyer_name
          FROM cook_profiles cp JOIN users u ON u.id = ${req.user.id}
          WHERE cp.id = ${product.cook_id}
          LIMIT 1
        `;
        const [cookRow] = await sql`SELECT user_id FROM cook_profiles WHERE id = ${product.cook_id}`;
        if (cookRow) {
          const buyerName = req.user.full_name ?? 'Someone';
          await notifyAndPush(
            cookRow.user_id, 'product_sale',
            '💰 New sale!',
            `${buyerName} just bought "${product.title}"`,
            { product_id: product.id }
          );
        }
      } catch {}
    })();

    // Never return the raw file_url — buyers must use GET /download which re-validates ownership
    res.status(201).json({ purchase: { ...purchase, download_url: undefined }, access_granted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

// ── GET /api/digital-products/my/purchases — customer's purchase history ─────
router.get('/my/purchases', authenticate, async (req, res) => {
  try {
    const purchases = await sql`
      SELECT dpp.id, dpp.product_id, dpp.purchased_at, dpp.amount_paid,
             dp.title, dp.type, dp.cover_image, dp.description,
             cp.display_name AS cook_name, cp.id AS cook_profile_id
      FROM digital_product_purchases dpp
      JOIN digital_products dp ON dp.id = dpp.product_id
      JOIN cook_profiles cp ON cp.id = dp.cook_id
      WHERE dpp.user_id = ${req.user.id}
      ORDER BY dpp.purchased_at DESC
    `;
    res.json({ purchases });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// ── GET /api/digital-products/:id/sales — cook views buyers ──────────────────
router.get('/:id/sales', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const [product] = await sql`SELECT * FROM digital_products WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}`;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const buyers = await sql`
      SELECT dpp.id, dpp.purchased_at, dpp.amount_paid,
             u.full_name AS buyer_name, u.avatar_url AS buyer_avatar
      FROM digital_product_purchases dpp
      JOIN users u ON u.id = dpp.user_id
      WHERE dpp.product_id = ${req.params.id}
      ORDER BY dpp.purchased_at DESC
    `;

    const totalRevenue = buyers.reduce((s, b) => s + parseFloat(b.amount_paid ?? 0), 0);

    res.json({ buyers, total_revenue: totalRevenue, copies_sold: buyers.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// ── GET /api/digital-products/:id/download — verified download ───────────────
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT dpp.download_url FROM digital_product_purchases dpp
      WHERE dpp.product_id = ${req.params.id} AND dpp.user_id = ${req.user.id}
    `;
    if (!rows.length) return res.status(403).json({ error: 'Purchase required to download' });
    res.json({ download_url: rows[0].download_url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch download URL' });
  }
});

module.exports = router;
