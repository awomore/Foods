const express = require('express');
const router = express.Router();
const { sql } = require('../supabase/db');
const { authenticate: auth } = require('../middleware/auth');

// ── GET /api/creator-branding/:cookId ─────────────────────────────────────────
router.get('/:cookId', async (req, res) => {
  try {
    const rows = await sql`
      SELECT
        cp.id, cp.display_name, cp.username, u.avatar_url, cp.bio,
        cp.cover_image, cp.brand_logo, cp.brand_colors,
        cp.typography_theme, cp.social_banner,
        cp.creator_types, cp.profile_slug,
        cp.instagram_handle, cp.tiktok_handle, cp.twitter_handle,
        cp.location, cp.average_rating, cp.platform_follower_count,
        cp.total_orders
      FROM cook_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.id = ${req.params.cookId} AND cp.is_active = true
    `;
    if (!rows.length) return res.status(404).json({ error: 'Creator not found' });
    res.json({ branding: rows[0] });
  } catch (err) {
    console.error('get branding error:', err);
    res.status(500).json({ error: 'Failed to load branding' });
  }
});

// ── GET /api/creator-branding/slug/:slug ─────────────────────────────────────
router.get('/slug/:slug', async (req, res) => {
  try {
    const rows = await sql`
      SELECT
        cp.id, cp.display_name, cp.username, u.avatar_url, cp.bio,
        cp.cover_image, cp.brand_logo, cp.brand_colors,
        cp.typography_theme, cp.social_banner,
        cp.creator_types, cp.profile_slug,
        cp.instagram_handle, cp.tiktok_handle, cp.twitter_handle,
        cp.location, cp.average_rating, cp.platform_follower_count,
        cp.total_orders, cp.food_safety_verified
      FROM cook_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.profile_slug = ${req.params.slug} AND cp.is_active = true
    `;
    if (!rows.length) return res.status(404).json({ error: 'Creator not found' });
    res.json({ branding: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load branding' });
  }
});

// ── PUT /api/creator-branding (auth required) ────────────────────────────────
router.put('/', auth, async (req, res) => {
  try {
    const {
      cover_image, brand_logo, brand_colors, typography_theme,
      social_banner, creator_types, profile_slug, bio,
    } = req.body;

    // Validate slug if provided
    if (profile_slug) {
      if (!/^[a-z0-9-]{3,50}$/.test(profile_slug)) {
        return res.status(400).json({ error: 'Slug must be 3-50 lowercase letters, numbers, hyphens' });
      }
      // Check uniqueness
      const existing = await sql`
        SELECT id FROM cook_profiles
        WHERE profile_slug = ${profile_slug} AND user_id != ${req.user.id}
      `;
      if (existing.length) {
        return res.status(409).json({ error: 'This profile URL is already taken' });
      }
    }

    // Build update object
    const updates = {};
    if (cover_image !== undefined)      updates.cover_image = cover_image;
    if (brand_logo !== undefined)       updates.brand_logo = brand_logo;
    if (brand_colors !== undefined)     updates.brand_colors = JSON.stringify(brand_colors);
    if (typography_theme !== undefined) updates.typography_theme = typography_theme;
    if (social_banner !== undefined)    updates.social_banner = social_banner;
    if (creator_types !== undefined)    updates.creator_types = creator_types;
    if (bio !== undefined)              updates.bio = bio;
    if (profile_slug !== undefined) {
      updates.profile_slug = profile_slug;
      updates.slug_updated_at = new Date().toISOString();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const setClause = Object.keys(updates)
      .map((k, i) => `${k} = $${i + 2}`)
      .join(', ');
    const values = [req.user.id, ...Object.values(updates)];

    const rows = await sql(
      `UPDATE cook_profiles SET ${setClause} WHERE user_id = $1 RETURNING *`,
      values
    );

    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json({ branding: rows[0], message: 'Branding updated' });
  } catch (err) {
    console.error('update branding error:', err);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// ── PUT /api/creator-branding/creator-types (auth) ───────────────────────────
router.put('/creator-types', auth, async (req, res) => {
  try {
    const { creator_types } = req.body;
    if (!Array.isArray(creator_types) || !creator_types.length) {
      return res.status(400).json({ error: 'At least one creator type required' });
    }

    const valid = [
      'home_cook','chef','pastry_chef','baker','mixologist',
      'caterer','culinary_instructor','food_brand',
    ];
    const invalid = creator_types.filter(t => !valid.includes(t));
    if (invalid.length) {
      return res.status(400).json({ error: `Invalid types: ${invalid.join(', ')}` });
    }

    const rows = await sql`
      UPDATE cook_profiles
      SET creator_types = ${creator_types}
      WHERE user_id = ${req.user.id}
      RETURNING id, creator_types
    `;
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json({ creator_types: rows[0].creator_types });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update creator types' });
  }
});

// ── GET /api/creator-branding/check-slug/:slug ───────────────────────────────
router.get('/check-slug/:slug', auth, async (req, res) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      return res.json({ available: false, reason: 'Invalid format' });
    }
    const rows = await sql`
      SELECT id FROM cook_profiles
      WHERE profile_slug = ${slug} AND user_id != ${req.user.id}
    `;
    res.json({ available: rows.length === 0 });
  } catch (err) {
    res.status(500).json({ error: 'Check failed' });
  }
});

module.exports = router;
