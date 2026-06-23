'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql }          = require('../supabase/db');
const ig               = require('../services/interestGraph');

// ── GET /api/follow-suggestions ───────────────────────────────────────────────
// Returns up to 20 creators the authenticated user might want to follow,
// ranked by interest-graph match + geographic popularity.
// Already-followed creators and the user's own cook profile are excluded.
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lat, lng, limit = 20 } = req.query;
    const hasGeo = !!(lat && lng);
    const latN   = hasGeo ? parseFloat(lat) : null;
    const lngN   = hasGeo ? parseFloat(lng) : null;
    const pageLimit = Math.min(parseInt(limit), 40);

    // User's existing follows — exclude these
    const existingFollows = await sql`
      SELECT cook_id FROM follows WHERE customer_id = ${userId}
    `;
    const followedIds = existingFollows.map(f => f.cook_id);

    // User's own cook profile (if any) — exclude self-follow
    const ownProfile = await sql`
      SELECT id FROM cook_profiles WHERE user_id = ${userId} LIMIT 1
    `;
    const excludeIds = [
      ...followedIds,
      ...(ownProfile[0] ? [ownProfile[0].id] : []),
    ];

    // Load user interest graph for cuisine-based matching
    const userGraph = await ig.getOrCreateGraph(userId);
    const topCuisines = Object.entries(userGraph.cuisine_affinities ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);

    // ── Candidate 1: Interest-graph match (cuisine affinity × creator_score) ─
    const interestCandidates = await sql`
      SELECT
        cp.id, cp.display_name, cp.username, cp.bio, cp.location, cp.cuisine_types,
        cp.is_live, cp.average_rating, cp.total_orders, cp.is_health_kitchen,
        u.avatar_url,
        COALESCE(csd.creator_score, 0) AS creator_score,
        COALESCE(csd.avg_rating_90d, cp.average_rating, 0) AS display_rating,
        'interest' AS suggestion_reason,
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
          ${excludeIds.length === 0}
          OR cp.id != ALL(${excludeIds.length > 0 ? excludeIds : [null]}::uuid[])
        )
        AND (
          ${topCuisines.length === 0}
          OR cp.cuisine_types && ${topCuisines}::text[]
        )
      ORDER BY COALESCE(csd.creator_score, 0) DESC
      LIMIT 15
    `;

    // ── Candidate 2: Geographic popularity (new-customer velocity) ────────
    const geoCandidates = await sql`
      SELECT
        cp.id, cp.display_name, cp.username, cp.bio, cp.location, cp.cuisine_types,
        cp.is_live, cp.average_rating, cp.total_orders, cp.is_health_kitchen,
        u.avatar_url,
        COALESCE(csd.creator_score, 0) AS creator_score,
        COALESCE(csd.avg_rating_90d, cp.average_rating, 0) AS display_rating,
        'popular_near_you' AS suggestion_reason,
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
      LEFT JOIN trending_entities te ON te.entity_id = cp.id AND te.entity_type = 'creator'
      WHERE cp.verification_status = 'approved'
        AND (
          ${excludeIds.length === 0}
          OR cp.id != ALL(${excludeIds.length > 0 ? excludeIds : [null]}::uuid[])
        )
        AND (
          ${!hasGeo}
          OR (
            cp.latitude IS NOT NULL AND cp.longitude IS NOT NULL
            AND (
              6371 * acos(
                cos(radians(${latN})) * cos(radians(cp.latitude))
                * cos(radians(cp.longitude) - radians(${lngN}))
                + sin(radians(${latN})) * sin(radians(cp.latitude))
              )
            ) <= 30
          )
        )
      ORDER BY te.trending_score DESC NULLS LAST, COALESCE(csd.creator_score, 0) DESC
      LIMIT 10
    `;

    // Merge: deduplicate by id, interest candidates first
    const seen = new Set();
    const merged = [];
    for (const c of [...interestCandidates, ...geoCandidates]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        merged.push(c);
      }
      if (merged.length >= pageLimit) break;
    }

    res.json({ suggestions: merged });
  } catch (err) {
    console.error('GET /follow-suggestions:', err);
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

module.exports = router;
