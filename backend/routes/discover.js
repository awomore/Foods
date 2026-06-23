const express = require('express');
const router = express.Router();
const { sql } = require('../supabase/db');

// ── GET /api/discover ───────────────────────────────────────────────────────
// Full-text search across cooks + dishes. No auth required.
router.get('/', async (req, res) => {
  try {
    const {
      q = '',
      mode,
      health,
      dietary,
      lat, lng,
      radius = 50,
      min_price, max_price,
      sort = 'rating',    // rating | distance | followers
      available_now,
      new_creators,       // true = joined in last 30 days, sorted by newest
      limit = 40,
      offset = 0,
    } = req.query;

    const term = `%${q.toLowerCase()}%`;
    const hasGeo = !!(lat && lng);
    const latN = hasGeo ? parseFloat(lat) : null;
    const lngN = hasGeo ? parseFloat(lng) : null;
    const radKm = parseFloat(radius);

    // ── Search cooks ──────────────────────────────────────────────────────
    const cooks = await sql`
      SELECT
        cp.*,
        u.full_name, u.avatar_url, u.country_code,
        COALESCE(csd.creator_score, 0) AS creator_score,
        'cook' AS result_type,
        ${hasGeo ? sql`
          ROUND((
            6371 * acos(
              cos(radians(${latN})) * cos(radians(cp.latitude))
              * cos(radians(cp.longitude) - radians(${lngN}))
              + sin(radians(${latN})) * sin(radians(cp.latitude))
            )
          )::numeric, 1)
        ` : sql`0::numeric`} AS distance_km
      FROM cook_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN creator_score_dimensions csd ON csd.cook_id = cp.id
      WHERE cp.verification_status = 'approved'
        AND (
          ${q} = ''
          OR LOWER(cp.display_name) LIKE ${term}
          OR LOWER(cp.username) LIKE ${term}
          OR LOWER(cp.bio) LIKE ${term}
          OR LOWER(cp.location) LIKE ${term}
          OR LOWER(cp.instagram_handle) LIKE ${term}
        )
        AND (${mode ?? null}::text IS NULL OR EXISTS (
          SELECT 1 FROM cook_modes cm
          WHERE cm.cook_id = cp.id AND cm.mode = ${mode ?? null} AND cm.is_enabled = true
        ))
        AND (${health === 'true' ? 'true' : null}::boolean IS NULL OR cp.is_health_kitchen = true)
        AND (${new_creators === 'true' ? 'true' : null}::boolean IS NULL OR u.created_at >= NOW() - INTERVAL '30 days')
        AND (
          ${!hasGeo}
          OR (
            cp.latitude IS NOT NULL
            AND cp.longitude IS NOT NULL
            AND (
              6371 * acos(
                cos(radians(${latN})) * cos(radians(cp.latitude))
                * cos(radians(cp.longitude) - radians(${lngN}))
                + sin(radians(${latN})) * sin(radians(cp.latitude))
              )
            ) <= ${radKm}
          )
        )
      ORDER BY COALESCE(csd.creator_score, 0) DESC
      LIMIT 20
    `;

    // ── Search dishes ─────────────────────────────────────────────────────
    // Sort options: 'rating' | 'distance' | 'relevance' (replaces gameable 'followers')
    const effectiveSort = sort === 'followers' ? 'relevance' : sort;
    const dishes = await sql`
      SELECT
        mi.*,
        cp.display_name AS cook_name, cp.username AS cook_username,
        cp.average_rating AS cook_rating, cp.location AS cook_location,
        cp.latitude, cp.longitude,
        COALESCE(csd.creator_score, 0) AS cook_creator_score,
        'dish' AS result_type,
        ${hasGeo ? sql`
          ROUND((
            6371 * acos(
              cos(radians(${latN})) * cos(radians(cp.latitude))
              * cos(radians(cp.longitude) - radians(${lngN}))
              + sin(radians(${latN})) * sin(radians(cp.latitude))
            )
          )::numeric, 1)
        ` : sql`0::numeric`} AS distance_km
      FROM menu_items mi
      JOIN cook_profiles cp ON cp.id = mi.cook_id
      LEFT JOIN creator_score_dimensions csd ON csd.cook_id = cp.id
      WHERE mi.is_active = true
        AND cp.verification_status = 'approved'
        AND (
          ${q} = ''
          OR LOWER(mi.title) LIKE ${term}
          OR LOWER(mi.description) LIKE ${term}
          OR LOWER(mi.cuisine_type) LIKE ${term}
          OR EXISTS (
            SELECT 1 FROM unnest(mi.ethnic_tags) AS t WHERE LOWER(t) LIKE ${term}
          )
          OR EXISTS (
            SELECT 1 FROM unnest(mi.ingredients) AS i WHERE LOWER(i) LIKE ${term}
          )
        )
        AND (${mode ?? null}::text IS NULL OR mi.mode = ${mode ?? null})
        AND (${min_price ?? null}::numeric IS NULL OR mi.unit_price >= ${parseFloat(min_price ?? 0)})
        AND (${max_price ?? null}::numeric IS NULL OR mi.unit_price <= ${parseFloat(max_price ?? 9999999)})
        AND (${dietary ?? null}::text IS NULL OR ${dietary ?? null} = 'none' OR
          NOT (${dietary ?? ''} = ANY(mi.allergens))
        )
        AND (
          ${available_now !== 'true'}
          OR mi.available_date = CURRENT_DATE
          OR mi.realtime_available = true
        )
        AND (
          ${!hasGeo}
          OR (
            cp.latitude IS NOT NULL
            AND cp.longitude IS NOT NULL
            AND (
              6371 * acos(
                cos(radians(${latN})) * cos(radians(cp.latitude))
                * cos(radians(cp.longitude) - radians(${lngN}))
                + sin(radians(${latN})) * sin(radians(cp.latitude))
              )
            ) <= ${radKm}
          )
        )
      ORDER BY
        CASE WHEN ${effectiveSort} = 'rating' THEN cp.average_rating END DESC NULLS LAST,
        CASE WHEN ${effectiveSort} = 'distance' THEN ${hasGeo ? sql`
          (6371 * acos(
            cos(radians(${latN})) * cos(radians(cp.latitude))
            * cos(radians(cp.longitude) - radians(${lngN}))
            + sin(radians(${latN})) * sin(radians(cp.latitude))
          ))` : sql`0`} END ASC NULLS LAST,
        -- Default / 'relevance': composite of creator quality + 90d order velocity
        CASE WHEN ${effectiveSort} NOT IN ('rating','distance') THEN
          COALESCE(csd.creator_score, 0) * 0.6 +
          LEAST(COALESCE(mi.order_count_90d, 0)::float / 50, 1.0) * 0.4
        END DESC NULLS LAST,
        mi.created_at DESC
      LIMIT 40
    `;

    // ── Health Kitchens (if health filter) ────────────────────────────────
    const healthKitchens = health === 'true' ? cooks.filter(c => c.is_health_kitchen) : [];

    res.json({
      cooks:          cooks.filter(c => !c.is_health_kitchen || health !== 'true'),
      dishes,
      health_kitchens: healthKitchens,
      total: cooks.length + dishes.length,
    });
  } catch (err) {
    console.error('GET /discover:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
