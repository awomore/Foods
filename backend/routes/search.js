const express = require('express');
const router = express.Router();
const { sql } = require('../supabase/db');

// ── GET /api/search?q=&type=&limit=&offset= ───────────────────────────────────
// Unified search across: cooks, dishes, posts, services, courses, digital_products, weekly_menus
router.get('/', async (req, res) => {
  try {
    const { q, type, limit = 20, offset = 0 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const query = q.trim();
    const lim = Math.min(+limit, 50);
    const off = +offset;

    // Build results based on type filter
    const types = type ? [type] : ['cooks', 'dishes', 'posts', 'courses', 'digital_products', 'services', 'weekly_menus'];
    const results = {};

    if (types.includes('cooks')) {
      results.cooks = await sql`
        SELECT
          cp.id, cp.display_name AS name, cp.avatar_url AS image,
          cp.bio AS description, cp.average_rating AS rating,
          cp.trust_score, cp.food_safety_verified,
          cp.accepts_private_chef, cp.accepts_catering,
          'cook' AS entity_type,
          ts_rank(to_tsvector('english', coalesce(cp.display_name,'') || ' ' || coalesce(cp.bio,'')),
                  plainto_tsquery('english', ${query})) AS rank
        FROM cook_profiles cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.is_active = true
          AND to_tsvector('english', coalesce(cp.display_name,'') || ' ' || coalesce(cp.bio,''))
              @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC, cp.average_rating DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('dishes')) {
      results.dishes = await sql`
        SELECT
          mi.id, mi.title AS name, mi.photos[1] AS image,
          mi.description, mi.unit_price AS price,
          mi.dietary_labels, mi.is_active AS is_available,
          cp.display_name AS cook_name, cp.id AS cook_id,
          'dish' AS entity_type,
          ts_rank(to_tsvector('english', coalesce(mi.title,'') || ' ' || coalesce(mi.description,'')),
                  plainto_tsquery('english', ${query})) AS rank
        FROM menu_items mi
        JOIN cook_profiles cp ON cp.id = mi.cook_id
        WHERE mi.is_active = true
          AND to_tsvector('english', coalesce(mi.title,'') || ' ' || coalesce(mi.description,''))
              @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('posts')) {
      results.posts = await sql`
        SELECT
          p.id, COALESCE(p.title, LEFT(p.body, 60)) AS name,
          p.photo_urls[1] AS image,
          p.body AS description,
          p.post_type, p.like_count, p.comment_count,
          cp.display_name AS cook_name, cp.id AS cook_id,
          'post' AS entity_type,
          ts_rank(to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.body,'')),
                  plainto_tsquery('english', ${query})) AS rank
        FROM cook_diary_posts p
        JOIN cook_profiles cp ON cp.id = p.cook_id
        WHERE p.status = 'published'
          AND to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.body,''))
              @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC, p.created_at DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('courses')) {
      results.courses = await sql`
        SELECT
          c.id, c.title AS name, c.cover_image AS image,
          c.description, c.price, c.enrollment_count, c.rating,
          c.difficulty_level, c.is_free,
          cp.display_name AS cook_name, cp.id AS cook_id,
          'course' AS entity_type,
          ts_rank(to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,'')),
                  plainto_tsquery('english', ${query})) AS rank
        FROM courses c
        JOIN cook_profiles cp ON cp.id = c.cook_id
        WHERE c.is_published = true
          AND to_tsvector('english', coalesce(c.title,'') || ' ' || coalesce(c.description,''))
              @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC, c.enrollment_count DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('digital_products')) {
      results.digital_products = await sql`
        SELECT
          dp.id, dp.title AS name, dp.cover_image AS image,
          dp.description, dp.price, dp.type, dp.download_count,
          cp.display_name AS cook_name, cp.id AS cook_id,
          'digital_product' AS entity_type
        FROM digital_products dp
        JOIN cook_profiles cp ON cp.id = dp.cook_id
        WHERE dp.is_published = true
          AND (dp.title ILIKE ${'%' + query + '%'} OR dp.description ILIKE ${'%' + query + '%'})
        ORDER BY dp.download_count DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('weekly_menus')) {
      results.weekly_menus = await sql`
        SELECT
          wm.id, wm.title AS name, wm.description,
          wm.week_start, wm.items,
          cp.display_name AS cook_name, cp.id AS cook_id,
          'weekly_menu' AS entity_type
        FROM weekly_menus wm
        JOIN cook_profiles cp ON cp.id = wm.cook_id
        WHERE wm.is_published = true
          AND (wm.title ILIKE ${'%' + query + '%'} OR wm.description ILIKE ${'%' + query + '%'})
        ORDER BY wm.week_start DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    // Autocomplete suggestions (top 5 names across entities)
    const suggestions = await sql`
      SELECT display_name AS label, 'cook' AS type FROM cook_profiles
      WHERE display_name ILIKE ${'%' + query + '%'} LIMIT 3
      UNION ALL
      SELECT title AS label, 'dish' AS type FROM menu_items
      WHERE is_active = true AND title ILIKE ${'%' + query + '%'} LIMIT 3
      UNION ALL
      SELECT title AS label, 'course' AS type FROM courses
      WHERE is_published = true AND title ILIKE ${'%' + query + '%'} LIMIT 2
      LIMIT 8
    `;

    res.json({ results, suggestions, query });
  } catch (err) {
    console.error('search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── GET /api/search/autocomplete?q= ─────────────────────────────────────────
router.get('/autocomplete', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.json({ suggestions: [] });

    const query = q.trim();
    const suggestions = await sql`
      SELECT display_name AS label, 'cook' AS type, id
      FROM cook_profiles
      WHERE display_name ILIKE ${query + '%'} LIMIT 4
      UNION ALL
      SELECT title AS label, 'dish' AS type, id
      FROM menu_items
      WHERE is_active = true AND title ILIKE ${query + '%'} LIMIT 4
      UNION ALL
      SELECT title AS label, 'course' AS type, id
      FROM courses
      WHERE is_published = true AND title ILIKE ${query + '%'} LIMIT 2
      LIMIT 10
    `;
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

module.exports = router;
