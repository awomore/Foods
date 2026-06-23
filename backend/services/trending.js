'use strict';

const { sql } = require('../supabase/db');

const clamp = (v, max = 1) => Math.max(0, Math.min(max, v ?? 0));

// Normalise an array of raw values to [0, 1] relative to the max in the set
function normalise(rows, field) {
  const max = Math.max(...rows.map(r => parseFloat(r[field]) || 0), 1);
  return rows.map(r => ({ ...r, [field]: (parseFloat(r[field]) || 0) / max }));
}

/**
 * Trending dishes: based on completed order velocity + new customer pull.
 * Requires unique customers — raw order counts are gameable.
 */
async function computeDishTrending() {
  const rows = await sql`
    SELECT
      mi.id AS entity_id,
      mi.title AS entity_label,
      COUNT(DISTINCT o.customer_id) FILTER (
        WHERE o.created_at >= NOW() - INTERVAL '7 days' AND o.status = 'delivered'
      )::float AS order_velocity_raw,
      COUNT(DISTINCT o.customer_id) FILTER (
        WHERE o.created_at >= NOW() - INTERVAL '7 days'
          AND o.status = 'delivered'
          AND NOT EXISTS (
            SELECT 1 FROM orders o2
            WHERE o2.customer_id = o.customer_id
              AND o2.menu_item_id = mi.id
              AND o2.created_at < NOW() - INTERVAL '7 days'
          )
      )::float AS new_customer_velocity_raw
    FROM menu_items mi
    JOIN orders o ON o.menu_item_id = mi.id
    WHERE mi.is_active = true
    GROUP BY mi.id, mi.title
    HAVING COUNT(DISTINCT o.customer_id) FILTER (
      WHERE o.created_at >= NOW() - INTERVAL '7 days' AND o.status = 'delivered'
    ) > 0
    ORDER BY order_velocity_raw DESC
    LIMIT 100
  `;

  if (!rows.length) return;

  let scored = normalise(rows, 'order_velocity_raw');
  scored     = normalise(scored, 'new_customer_velocity_raw');

  const now = new Date().toISOString();
  // Clear old dish trending entries then insert fresh
  await sql`DELETE FROM trending_entities WHERE entity_type = 'dish'`;
  for (const row of scored) {
    const trending_score = clamp(
      row.order_velocity_raw       * 0.55 +
      row.new_customer_velocity_raw * 0.45
    );
    await sql`
      INSERT INTO trending_entities
        (entity_type, entity_id, entity_label, order_velocity, new_customer_velocity, trending_score, computed_at)
      VALUES
        ('dish', ${row.entity_id}, ${row.entity_label}, ${row.order_velocity_raw}, ${row.new_customer_velocity_raw}, ${trending_score}, ${now})
    `;
  }
  console.log(`[trending] dish: ${scored.length} entries written`);
}

/**
 * Trending creators: new-customer acquisition velocity in last 14 days.
 */
async function computeCreatorTrending() {
  const rows = await sql`
    SELECT
      cp.id AS entity_id,
      cp.display_name AS entity_label,
      COUNT(DISTINCT o.customer_id) FILTER (
        WHERE o.created_at >= NOW() - INTERVAL '14 days'
          AND o.status = 'delivered'
          AND NOT EXISTS (
            SELECT 1 FROM orders o2
            WHERE o2.customer_id = o.customer_id
              AND o2.cook_id = cp.id
              AND o2.created_at < NOW() - INTERVAL '14 days'
          )
      )::float AS new_customer_velocity_raw
    FROM cook_profiles cp
    JOIN orders o ON o.cook_id = cp.id
    WHERE cp.verification_status = 'approved'
    GROUP BY cp.id, cp.display_name
    HAVING COUNT(DISTINCT o.customer_id) FILTER (
      WHERE o.created_at >= NOW() - INTERVAL '14 days' AND o.status = 'delivered'
    ) > 0
    ORDER BY new_customer_velocity_raw DESC
    LIMIT 50
  `;

  if (!rows.length) return;
  const scored = normalise(rows, 'new_customer_velocity_raw');

  const now = new Date().toISOString();
  await sql`DELETE FROM trending_entities WHERE entity_type = 'creator'`;
  for (const row of scored) {
    await sql`
      INSERT INTO trending_entities
        (entity_type, entity_id, entity_label, new_customer_velocity, trending_score, computed_at)
      VALUES
        ('creator', ${row.entity_id}, ${row.entity_label}, ${row.new_customer_velocity_raw}, ${row.new_customer_velocity_raw}, ${now})
    `;
  }
  console.log(`[trending] creator: ${scored.length} entries written`);
}

/**
 * Trending search terms: weighted by unique users + order conversion.
 * Requires unique_user_count column added in migration 026.
 */
async function computeSearchTrending() {
  const rows = await sql`
    SELECT
      term AS entity_label,
      SUM(search_count)            AS raw_count,
      MAX(unique_user_count)       AS unique_users,
      MAX(order_conversion_count)  AS conversions
    FROM search_trending
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY term
    ORDER BY raw_count DESC
    LIMIT 30
  `;

  if (!rows.length) return;

  const max_count     = Math.max(...rows.map(r => parseFloat(r.raw_count)   || 0), 1);
  const max_unique    = Math.max(...rows.map(r => parseFloat(r.unique_users) || 0), 1);
  const max_conv      = Math.max(...rows.map(r => parseFloat(r.conversions)  || 0), 1);

  const now = new Date().toISOString();
  await sql`DELETE FROM trending_entities WHERE entity_type = 'search'`;
  for (const row of rows) {
    const countNorm  = (parseFloat(row.raw_count)   || 0) / max_count;
    const uniqueNorm = (parseFloat(row.unique_users) || 0) / max_unique;
    const convNorm   = (parseFloat(row.conversions)  || 0) / max_conv;
    const trending_score = clamp(countNorm * 0.4 + convNorm * 0.4 + uniqueNorm * 0.2);

    await sql`
      INSERT INTO trending_entities
        (entity_type, entity_label, trending_score, computed_at)
      VALUES
        ('search', ${row.entity_label}, ${trending_score}, ${now})
    `;
  }
  console.log(`[trending] search: ${rows.length} entries written`);
}

/**
 * Run all trending computations. Called by the scheduler.
 */
async function computeAll() {
  await Promise.all([
    computeDishTrending(),
    computeCreatorTrending(),
    computeSearchTrending(),
  ]);
  // Cleanup old rows older than 24 hours
  await sql`DELETE FROM trending_entities WHERE computed_at < NOW() - INTERVAL '25 hours'`;
}

module.exports = { computeDishTrending, computeCreatorTrending, computeSearchTrending, computeAll };
