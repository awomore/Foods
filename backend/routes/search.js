const express = require('express');
const router = express.Router();
const { sql } = require('../supabase/db');

// ── GET /api/search?q=&type=&creator_type=&limit=&offset= ────────────────────
router.get('/', async (req, res) => {
  try {
    const { q, type, creator_type, limit = 20, offset = 0 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const query = q.trim();
    const lim = Math.min(+limit, 50);
    const off = +offset;

    // Record trending (fire and forget)
    sql`SELECT upsert_trending_search(${query})`.catch(() => {});

    const types = type
      ? [type]
      : ['cooks','dishes','posts','courses','digital_products','services','weekly_menus','stories','customer_posts'];

    const results = {};

    if (types.includes('cooks')) {
      const ctFilter = creator_type
        ? sql`AND ${creator_type} = ANY(cp.creator_types)`
        : sql``;

      results.cooks = await sql`
        SELECT
          cp.id, cp.display_name AS name, cp.avatar_url AS image,
          cp.bio AS description, cp.average_rating AS rating,
          cp.trust_score, cp.food_safety_verified,
          cp.accepts_private_chef, cp.accepts_catering,
          cp.creator_types, cp.profile_slug,
          cp.platform_follower_count,
          'cook' AS entity_type,
          ts_rank(to_tsvector('english', coalesce(cp.display_name,'') || ' ' || coalesce(cp.bio,'')),
                  plainto_tsquery('english', ${query})) AS rank
        FROM cook_profiles cp
        WHERE cp.is_active = true
          ${ctFilter}
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
          mi.video_url, mi.slug,
          cp.display_name AS cook_name, cp.id AS cook_id, cp.profile_slug AS cook_slug,
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
          COALESCE(p.photo_urls[1], p.video_thumbnail) AS image,
          p.body AS description,
          p.post_type, p.like_count, p.comment_count,
          p.video_url, p.video_thumbnail,
          cp.display_name AS cook_name, cp.id AS cook_id, cp.profile_slug AS cook_slug,
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
          c.difficulty_level, c.is_free, c.slug,
          cp.display_name AS cook_name, cp.id AS cook_id, cp.profile_slug AS cook_slug,
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
          dp.description, dp.price, dp.type, dp.download_count, dp.slug,
          cp.display_name AS cook_name, cp.id AS cook_id, cp.profile_slug AS cook_slug,
          'digital_product' AS entity_type
        FROM digital_products dp
        JOIN cook_profiles cp ON cp.id = dp.cook_id
        WHERE dp.is_published = true
          AND (dp.title ILIKE ${'%' + query + '%'} OR dp.description ILIKE ${'%' + query + '%'})
        ORDER BY dp.download_count DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('services')) {
      results.services = await sql`
        SELECT
          cp.id, cp.display_name AS name, cp.avatar_url AS image,
          cp.bio AS description,
          cp.accepts_private_chef, cp.accepts_catering,
          cp.max_guest_count, cp.service_regions,
          cp.creator_types, cp.profile_slug,
          'service' AS entity_type
        FROM cook_profiles cp
        WHERE cp.is_active = true
          AND (cp.accepts_private_chef = true OR cp.accepts_catering = true)
          AND (cp.display_name ILIKE ${'%' + query + '%'} OR cp.bio ILIKE ${'%' + query + '%'})
        ORDER BY cp.average_rating DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('weekly_menus')) {
      results.weekly_menus = await sql`
        SELECT
          wm.id, wm.title AS name, wm.description,
          wm.week_start, wm.items, wm.slug,
          cp.display_name AS cook_name, cp.id AS cook_id, cp.profile_slug AS cook_slug,
          'weekly_menu' AS entity_type
        FROM weekly_menus wm
        JOIN cook_profiles cp ON cp.id = wm.cook_id
        WHERE wm.is_published = true
          AND (wm.title ILIKE ${'%' + query + '%'} OR wm.description ILIKE ${'%' + query + '%'})
        ORDER BY wm.week_start DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('stories')) {
      results.stories = await sql`
        SELECT
          s.id, s.caption AS name, s.media_url AS image,
          s.media_type, s.video_url, s.video_thumbnail,
          s.created_at,
          cp.display_name AS cook_name, cp.id AS cook_id, cp.profile_slug AS cook_slug,
          'story' AS entity_type
        FROM stories s
        JOIN cook_profiles cp ON cp.id = s.cook_id
        WHERE s.expires_at > now()
          AND (s.caption ILIKE ${'%' + query + '%'})
        ORDER BY s.created_at DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    if (types.includes('customer_posts')) {
      results.customer_posts = await sql`
        SELECT
          cp.id, LEFT(cp.body, 80) AS name, cp.photo_urls[1] AS image,
          cp.body AS description, cp.like_count,
          cp.video_url, cp.video_thumbnail,
          u.full_name AS author_name, u.avatar_url AS author_avatar,
          'customer_post' AS entity_type
        FROM customer_posts cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.status = 'published'
          AND cp.body ILIKE ${'%' + query + '%'}
        ORDER BY cp.created_at DESC
        LIMIT ${lim} OFFSET ${off}
      `;
    }

    // Autocomplete suggestions
    const suggestions = await sql`
      SELECT display_name AS label, 'cook' AS type, profile_slug AS slug FROM cook_profiles
      WHERE display_name ILIKE ${'%' + query + '%'} AND is_active = true LIMIT 3
      UNION ALL
      SELECT title AS label, 'dish' AS type, slug FROM menu_items
      WHERE is_active = true AND title ILIKE ${'%' + query + '%'} LIMIT 3
      UNION ALL
      SELECT title AS label, 'course' AS type, slug FROM courses
      WHERE is_published = true AND title ILIKE ${'%' + query + '%'} LIMIT 2
      UNION ALL
      SELECT title AS label, 'product' AS type, slug FROM digital_products
      WHERE is_published = true AND title ILIKE ${'%' + query + '%'} LIMIT 2
      LIMIT 10
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
      SELECT display_name AS label, 'cook' AS type, id, profile_slug AS slug, avatar_url AS image
      FROM cook_profiles
      WHERE is_active = true AND display_name ILIKE ${query + '%'} LIMIT 4
      UNION ALL
      SELECT title AS label, 'dish' AS type, id, slug, photos[1] AS image
      FROM menu_items
      WHERE is_active = true AND title ILIKE ${query + '%'} LIMIT 4
      UNION ALL
      SELECT title AS label, 'course' AS type, id, slug, cover_image AS image
      FROM courses
      WHERE is_published = true AND title ILIKE ${query + '%'} LIMIT 2
      LIMIT 10
    `;
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

// ── GET /api/search/trending ─────────────────────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const trending = await sql`
      SELECT query, count
      FROM search_trending
      WHERE last_seen > now() - INTERVAL '7 days'
      ORDER BY count DESC
      LIMIT 10
    `;
    res.json({ trending });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load trending searches' });
  }
});

// ── GET /api/search/recent?userId= ──────────────────────────────────────────
router.get('/recent', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json({ recent: [] });

    const recent = await sql`
      SELECT DISTINCT ON (query) query, result_type, created_at
      FROM search_history
      WHERE user_id = ${userId}
      ORDER BY query, created_at DESC
      LIMIT 10
    `;
    res.json({ recent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load recent searches' });
  }
});

// ── POST /api/search/recent ──────────────────────────────────────────────────
router.post('/recent', async (req, res) => {
  try {
    const { userId, query, result_type } = req.body;
    if (!userId || !query) return res.status(400).json({ error: 'userId and query required' });

    await sql`
      INSERT INTO search_history (user_id, query, result_type)
      VALUES (${userId}, ${query}, ${result_type ?? null})
    `;
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save search' });
  }
});

// ── DELETE /api/search/recent/:userId ────────────────────────────────────────
router.delete('/recent/:userId', async (req, res) => {
  try {
    await sql`DELETE FROM search_history WHERE user_id = ${req.params.userId}`;
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

module.exports = router;
