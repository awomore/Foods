'use strict';

const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { sql }          = require('../supabase/db');
const ranking          = require('../services/ranking');
const ig               = require('../services/interestGraph');

// ── GET /api/feed/home ────────────────────────────────────────────────────────
// Primary home feed. Works with or without auth; anonymous users get
// a generic ranked feed without personalisation.
router.get('/home', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, limit = 30 } = req.query;
    const userId = req.user?.id ?? null;
    const hasGeo = !!(lat && lng);
    const latN   = hasGeo ? parseFloat(lat) : null;
    const lngN   = hasGeo ? parseFloat(lng) : null;
    const pageLimit = Math.min(parseInt(limit), 60);

    // ── 1. Load user interest graph (authenticated only) ──────────────────
    let userGraph = null;
    if (userId) {
      try { userGraph = await ig.getOrCreateGraph(userId); } catch {}
    }

    // ── 2. Candidate generation — approved cooks with creator_score ───────
    const candidates = await sql`
      SELECT
        cp.*,
        u.full_name, u.avatar_url, u.country_code,
        COALESCE(csd.creator_score, 0)         AS creator_score,
        COALESCE(csd.avg_rating_90d, cp.average_rating, 0) AS display_rating,
        COALESCE(cdi.phase, 3)                 AS _debut_phase,
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
      LEFT JOIN creator_debut_impressions cdi ON cdi.cook_id = cp.id
      WHERE cp.verification_status = 'approved'
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
            ) <= 80
          )
        )
      ORDER BY COALESCE(csd.creator_score, 0) DESC
      LIMIT 200
    `;

    if (!candidates.length) {
      return res.json({
        for_you: [], live: [], trending: [], new_this_week: [], order_again: [],
        weekly_menus: [], courses: [],
      });
    }

    const cookIds = candidates.map(c => c.id);

    // ── 3. Batch-fetch enrichment data ────────────────────────────────────
    const [todayItems, modes, discounts, storyCounts, orderedByUser, trendingIds] = await Promise.all([
      sql`
        SELECT * FROM menu_items
        WHERE cook_id = ANY(${cookIds}::uuid[]) AND is_active = true
          AND (available_date = CURRENT_DATE OR realtime_available = true)
          AND slots_claimed < total_slots
        ORDER BY created_at DESC
      `,
      sql`SELECT cook_id, mode FROM cook_modes WHERE cook_id = ANY(${cookIds}::uuid[]) AND is_enabled = true`,
      sql`
        SELECT * FROM cook_discounts
        WHERE cook_id = ANY(${cookIds}::uuid[]) AND is_active = true
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at > NOW())
      `,
      sql`
        SELECT cook_id, COUNT(*) AS story_count
        FROM stories
        WHERE cook_id = ANY(${cookIds}::uuid[]) AND is_active = true AND expires_at > NOW()
        GROUP BY cook_id
      `,
      userId ? sql`
        SELECT DISTINCT cook_id FROM orders
        WHERE customer_id = ${userId} AND cook_id = ANY(${cookIds}::uuid[]) AND status = 'delivered'
      ` : sql`SELECT null::uuid AS cook_id WHERE false`,
      sql`SELECT entity_id FROM trending_entities WHERE entity_type = 'creator' ORDER BY trending_score DESC LIMIT 20`,
    ]);

    const itemsByC     = todayItems.reduce((a, i) => { (a[i.cook_id] ??= []).push(i); return a; }, {});
    const modesByC     = modes.reduce((a, m) => { (a[m.cook_id] ??= []).push(m.mode); return a; }, {});
    const discByC      = discounts.reduce((a, d) => { (a[d.cook_id] ??= []).push(d); return a; }, {});
    const storyByC     = storyCounts.reduce((a, s) => { a[s.cook_id] = parseInt(s.story_count); return a; }, {});
    const orderedSet   = new Set(orderedByUser.map(r => r.cook_id));
    const trendingSet  = new Set(trendingIds.map(r => r.entity_id));

    // ── 4. Attach enrichment + score ──────────────────────────────────────
    const enriched = candidates.map(c => ({
      ...c,
      today_items:      itemsByC[c.id] ?? [],
      enabled_modes:    modesByC[c.id] ?? [],
      active_discounts: discByC[c.id]  ?? [],
      has_story:        (storyByC[c.id] ?? 0) > 0,
      _has_ordered:     orderedSet.has(c.id),
      _feed_score:      ranking.scoreFeed(c, userGraph, hasGeo ? { lat: latN, lng: lngN } : null),
    }));

    // ── 5. Score, anti-monopoly, and split into sections ──────────────────
    const sorted = enriched
      .sort((a, b) => b._feed_score - a._feed_score);
    const diversified = ranking.applyAntiMonopoly(sorted);

    const liveCooks      = enriched.filter(c => c.is_live).slice(0, 10);
    const newThisWeek    = [...enriched]
      .filter(c => {
        const d = new Date(c.joined_at ?? c.created_at ?? 0);
        return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => new Date(b.joined_at ?? 0) - new Date(a.joined_at ?? 0))
      .slice(0, 8);

    const trendingCooks  = enriched
      .filter(c => trendingSet.has(c.id))
      .sort((a, b) => (b.creator_score ?? 0) - (a.creator_score ?? 0))
      .slice(0, 10);

    // Order-again: return cooks the user has ordered from before
    const orderAgainCooks = userId
      ? enriched.filter(c => c._has_ordered).sort((a, b) => b._feed_score - a._feed_score).slice(0, 5)
      : [];

    const forYou = diversified.slice(0, pageLimit);

    // ── 6. Weekly menus + courses (parallel) ─────────────────────────────
    const [weeklyMenusRows, coursesRows] = await Promise.all([
      sql`
        SELECT wmp.id, wmp.cook_id, wmp.week_start_date, wmp.title, wmp.is_published,
               cp.display_name AS cook_name, cp.avatar_url AS cook_avatar,
               COALESCE(csd.creator_score, 0) AS creator_score
        FROM weekly_meal_plans wmp
        JOIN cook_profiles cp ON cp.id = wmp.cook_id
        LEFT JOIN creator_score_dimensions csd ON csd.cook_id = wmp.cook_id
        WHERE wmp.is_published = true
          AND wmp.week_start_date >= date_trunc('week', CURRENT_DATE)
        ORDER BY csd.creator_score DESC NULLS LAST, wmp.updated_at DESC
        LIMIT 6
      `,
      sql`
        SELECT c.id, c.title, c.cover_image, c.price, c.is_free,
               c.enrollment_count, c.lesson_count,
               cp.display_name AS cook_name,
               COALESCE(csd.creator_score, 0) AS creator_score
        FROM courses c
        JOIN cook_profiles cp ON cp.id = c.cook_id
        LEFT JOIN creator_score_dimensions csd ON csd.cook_id = c.cook_id
        WHERE c.is_published = true
        ORDER BY (
          SELECT COUNT(*) FROM course_enrollments ce
          WHERE ce.course_id = c.id AND ce.created_at >= NOW() - INTERVAL '90 days'
        ) DESC, csd.creator_score DESC NULLS LAST
        LIMIT 10
      `,
    ]);

    // Strip private social handles before responding
    const stripHandles = ({ instagram_handle, tiktok_handle, youtube_url, twitter_handle, _feed_score, _has_ordered, _debut_phase, ...c }) => c;

    res.json({
      for_you:      forYou.map(stripHandles),
      live:         liveCooks.map(stripHandles),
      trending:     trendingCooks.map(stripHandles),
      new_this_week: newThisWeek.map(stripHandles),
      order_again:  orderAgainCooks.map(stripHandles),
      weekly_menus: weeklyMenusRows,
      courses:      coursesRows,
    });
  } catch (err) {
    console.error('GET /feed/home:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
});

module.exports = router;
