'use strict';

const { sql } = require('../supabase/db');

async function snapshotHealth() {
  const interventions = [];

  // ── Supply metrics ────────────────────────────────────────────────────────
  const [supply] = await sql`
    SELECT
      -- Activation rate: cooks approved in last 30d who have placed ≥1 order in same window
      ROUND(
        100.0 *
        COUNT(cp.id) FILTER (
          WHERE cp.verification_status = 'approved'
            AND cp.created_at >= NOW() - INTERVAL '30 days'
            AND EXISTS (SELECT 1 FROM orders o WHERE o.cook_id = cp.id AND o.created_at >= NOW() - INTERVAL '30 days')
        )::numeric /
        NULLIF(COUNT(cp.id) FILTER (WHERE cp.verification_status = 'approved' AND cp.created_at >= NOW() - INTERVAL '30 days'), 0)
      , 1) AS new_creator_activation_rate_30d,

      -- 60-day retention: cooks approved 60-90 days ago who are still active (order in last 30d)
      ROUND(
        100.0 *
        COUNT(cp.id) FILTER (
          WHERE cp.verification_status = 'approved'
            AND cp.created_at BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '60 days'
            AND EXISTS (SELECT 1 FROM orders o WHERE o.cook_id = cp.id AND o.created_at >= NOW() - INTERVAL '30 days')
        )::numeric /
        NULLIF(COUNT(cp.id) FILTER (
          WHERE cp.verification_status = 'approved'
            AND cp.created_at BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '60 days'
        ), 0)
      , 1) AS creator_60d_retention_rate,

      -- GMV concentration: top-10 cooks' share of total GMV in last 30 days
      (
        SELECT ROUND(
          100.0 * SUM(cook_gmv) / NULLIF(total_gmv, 0),
          1
        )
        FROM (
          SELECT
            SUM(cook_payout) AS cook_gmv
          FROM orders
          WHERE cook_id IN (
            SELECT cook_id FROM orders
            WHERE status = 'delivered' AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY cook_id ORDER BY SUM(cook_payout) DESC LIMIT 10
          )
          AND status = 'delivered' AND created_at >= NOW() - INTERVAL '30 days'
        ) top10,
        (SELECT SUM(cook_payout) AS total_gmv FROM orders WHERE status = 'delivered' AND created_at >= NOW() - INTERVAL '30 days') tot
      ) AS top10_gmv_concentration

    FROM cook_profiles cp
  `;

  // ── Demand metrics ────────────────────────────────────────────────────────
  const [demand] = await sql`
    SELECT
      -- New user first-order rate in 7 days
      ROUND(
        100.0 *
        COUNT(DISTINCT u.id) FILTER (
          WHERE u.created_at >= NOW() - INTERVAL '7 days'
            AND EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = u.id)
        )::numeric /
        NULLIF(COUNT(DISTINCT u.id) FILTER (WHERE u.created_at >= NOW() - INTERVAL '7 days'), 0)
      , 1) AS new_user_first_order_rate_7d,

      -- Day-30 retention: users who placed an order in their first 7 days AND again in days 23-37
      ROUND(
        100.0 *
        COUNT(DISTINCT u.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = u.id AND o.created_at BETWEEN u.created_at AND u.created_at + INTERVAL '7 days')
            AND EXISTS (SELECT 1 FROM orders o2 WHERE o2.customer_id = u.id AND o2.created_at BETWEEN u.created_at + INTERVAL '23 days' AND u.created_at + INTERVAL '37 days')
        )::numeric /
        NULLIF(COUNT(DISTINCT u.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = u.id AND o.created_at BETWEEN u.created_at AND u.created_at + INTERVAL '7 days')
            AND u.created_at <= NOW() - INTERVAL '37 days'
        ), 0)
      , 1) AS day30_retention_rate

    FROM users u WHERE role = 'customer'
  `;

  // ── Automated interventions ───────────────────────────────────────────────
  const activationRate    = parseFloat(supply.new_creator_activation_rate_30d) || 0;
  const top10Concentration = parseFloat(supply.top10_gmv_concentration) || 0;
  const firstOrderRate    = parseFloat(demand.new_user_first_order_rate_7d) || 0;

  if (activationRate < 40) interventions.push('low_creator_activation_boost_debut');
  if (top10Concentration > 60) interventions.push('top10_concentration_alarm');
  if (firstOrderRate < 30) interventions.push('low_new_user_conversion_alarm');

  // ── Write snapshot ────────────────────────────────────────────────────────
  await sql`
    INSERT INTO marketplace_health_snapshots (
      snapshot_date,
      new_creator_activation_rate_30d,
      creator_60d_retention_rate,
      top10_gmv_concentration,
      new_user_first_order_rate_7d,
      day30_retention_rate,
      interventions_triggered
    ) VALUES (
      CURRENT_DATE,
      ${supply.new_creator_activation_rate_30d ?? null},
      ${supply.creator_60d_retention_rate ?? null},
      ${supply.top10_gmv_concentration ?? null},
      ${demand.new_user_first_order_rate_7d ?? null},
      ${demand.day30_retention_rate ?? null},
      ${interventions}
    )
    ON CONFLICT (snapshot_date) DO UPDATE SET
      new_creator_activation_rate_30d = EXCLUDED.new_creator_activation_rate_30d,
      creator_60d_retention_rate      = EXCLUDED.creator_60d_retention_rate,
      top10_gmv_concentration         = EXCLUDED.top10_gmv_concentration,
      new_user_first_order_rate_7d    = EXCLUDED.new_user_first_order_rate_7d,
      day30_retention_rate            = EXCLUDED.day30_retention_rate,
      interventions_triggered         = EXCLUDED.interventions_triggered
  `;

  if (interventions.length > 0) {
    console.warn('[health] interventions triggered:', interventions.join(', '));
  }

  console.log('[health] snapshot written for', new Date().toISOString().slice(0, 10));
  return { supply, demand, interventions };
}

module.exports = { snapshotHealth };
