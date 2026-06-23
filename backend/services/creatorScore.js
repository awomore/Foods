'use strict';

const { sql } = require('../supabase/db');

// ── Dimension weights ─────────────────────────────────────────────────────────
const WEIGHTS = {
  order_quality:       0.35,
  reliability:         0.20,
  content_activity:    0.15,
  audience_health:     0.15,
  trust_verify:        0.10,
  marketplace_contrib: 0.05,
};

// Clamp a value to [0, 1]
const clamp = v => Math.max(0, Math.min(1, v ?? 0));

// Saturation curve: returns 1.0 at target, diminishing returns above it
function saturate(value, target) {
  if (target === 0) return 0;
  return clamp(value / target);
}

// ── Dimension computations ─────────────────────────────────────────────────────

async function computeOrderQuality(cookId) {
  const [row] = await sql`
    SELECT
      COALESCE(AVG(r.rating) FILTER (WHERE r.created_at >= NOW() - INTERVAL '90 days'), 0)  AS avg_rating_90d,
      COALESCE(
        1.0 - (
          COUNT(*) FILTER (WHERE o.status IN ('cancelled','refunded') AND o.created_at >= NOW() - INTERVAL '90 days')
          ::float /
          NULLIF(COUNT(*) FILTER (WHERE o.created_at >= NOW() - INTERVAL '90 days'), 0)
        ), 1
      ) AS completion_rate_90d,
      COALESCE(
        (
          SELECT COUNT(DISTINCT o2.customer_id) FILTER (
            WHERE (SELECT COUNT(*) FROM orders o3 WHERE o3.customer_id = o2.customer_id AND o3.cook_id = ${cookId} AND o3.status = 'delivered') > 1
          )::float /
          NULLIF(COUNT(DISTINCT o2.customer_id) FILTER (WHERE o2.status = 'delivered'), 0)
          FROM orders o2 WHERE o2.cook_id = ${cookId} AND o2.created_at >= NOW() - INTERVAL '90 days'
        ), 0
      ) AS repeat_order_rate
    FROM orders o
    LEFT JOIN reviews r ON r.order_id = o.id
    WHERE o.cook_id = ${cookId}
  `;

  const avg_rating_90d      = parseFloat(row.avg_rating_90d)      || 0;
  const completion_rate_90d = parseFloat(row.completion_rate_90d) || 0;
  const repeat_order_rate   = parseFloat(row.repeat_order_rate)   || 0;

  // 5-star = 1.0, 4-star = 0.8, etc.
  const ratingNorm = clamp(avg_rating_90d / 5);
  const score = clamp(ratingNorm * 0.5 + completion_rate_90d * 0.3 + repeat_order_rate * 0.2);

  return { score, avg_rating_90d, completion_rate_90d, repeat_order_rate };
}

async function computeReliability(cookId) {
  const [row] = await sql`
    SELECT
      COALESCE(
        1.0 - (
          COUNT(*) FILTER (WHERE delivery_sla_breached = true AND created_at >= NOW() - INTERVAL '90 days')
          ::float /
          NULLIF(COUNT(*) FILTER (WHERE delivered_at IS NOT NULL AND created_at >= NOW() - INTERVAL '90 days'), 0)
        ), 1
      ) AS on_time_rate,
      COALESCE(
        1.0 - (
          COUNT(*) FILTER (WHERE status IN ('cancelled','refunded') AND created_at >= NOW() - INTERVAL '90 days')
          ::float /
          NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '90 days'), 0)
        ), 1
      ) AS cancellation_inv_rate
    FROM orders
    WHERE cook_id = ${cookId}
  `;

  // response_rate: approximate via cook_profiles accepted/rejected flow
  const [profileRow] = await sql`
    SELECT response_rate FROM cook_profiles WHERE id = ${cookId}
  `;

  const on_time_rate       = clamp(parseFloat(row.on_time_rate) || 1);
  const cancellation_rate  = clamp(1 - (parseFloat(row.cancellation_inv_rate) || 1));
  const response_rate      = clamp(parseFloat(profileRow?.response_rate) || 1);

  const score = clamp(on_time_rate * 0.5 + response_rate * 0.3 + (1 - cancellation_rate) * 0.2);
  return { score, on_time_rate, response_rate, cancellation_rate };
}

async function computeContentActivity(cookId) {
  const [row] = await sql`
    SELECT
      COALESCE(
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::float / 7,
        0
      ) AS posts_per_day,
      COALESCE(
        COUNT(*) FILTER (WHERE type IN ('photo','video','live') AND created_at >= NOW() - INTERVAL '7 days')::float / 7,
        0
      ) AS stories_per_day
    FROM (
      SELECT created_at, 'post' AS type FROM diary_posts WHERE cook_id = ${cookId}
      UNION ALL
      SELECT created_at, type FROM stories WHERE cook_id = ${cookId} AND is_active = true
    ) combined
  `;

  const posts_per_week   = parseFloat(row.posts_per_day)   * 7 || 0;
  const stories_per_week = parseFloat(row.stories_per_day) * 7 || 0;

  // Saturation at 7 posts/week, 14 stories/week
  const postScore  = saturate(posts_per_week,   7);
  const storyScore = saturate(stories_per_week, 14);
  const score = clamp(postScore * 0.5 + storyScore * 0.5);

  return { score, posts_per_week, stories_per_week };
}

async function computeAudienceHealth(cookId) {
  const [followerRow] = await sql`
    SELECT
      platform_follower_count,
      COALESCE(
        (
          SELECT COUNT(*) FILTER (WHERE f.created_at >= NOW() - INTERVAL '30 days')::float /
          NULLIF(GREATEST(platform_follower_count - COUNT(*) FILTER (WHERE f.created_at < NOW() - INTERVAL '30 days'), 1), 0)
          FROM follows f WHERE f.cook_id = ${cookId}
        ), 0
      ) AS follower_growth_30d
    FROM cook_profiles WHERE id = ${cookId}
  `;

  const [convRow] = await sql`
    SELECT
      COALESCE(
        COUNT(DISTINCT o.customer_id)::float /
        NULLIF((SELECT COUNT(*) FROM follows WHERE cook_id = ${cookId}), 0),
        0
      ) AS follower_to_order_conv
    FROM orders o WHERE o.cook_id = ${cookId} AND o.status = 'delivered'
  `;

  const [storyCompRow] = await sql`
    SELECT
      COALESCE(
        COUNT(sc.story_id)::float /
        NULLIF(COUNT(sv.story_id), 0),
        0
      ) AS story_completion_rate
    FROM story_views sv
    JOIN stories s ON s.id = sv.story_id AND s.cook_id = ${cookId}
    LEFT JOIN story_completions sc ON sc.story_id = sv.story_id AND sc.viewer_id = sv.viewer_id
    WHERE s.created_at >= NOW() - INTERVAL '30 days'
  `;

  const follower_to_order_conv   = clamp(parseFloat(convRow?.follower_to_order_conv)          || 0);
  const follower_growth_rate_30d = clamp(parseFloat(followerRow?.follower_growth_30d)          || 0);
  const story_completion_rate    = clamp(parseFloat(storyCompRow?.story_completion_rate)       || 0);

  // Conversion saturates at 5% (unusual to convert >5% of followers)
  const convScore  = saturate(follower_to_order_conv, 0.05);
  const growScore  = clamp(follower_growth_rate_30d * 10); // 10% monthly growth = 1.0
  const storyScore = story_completion_rate;
  const score = clamp(convScore * 0.4 + growScore * 0.3 + storyScore * 0.3);

  return { score, follower_to_order_conv, follower_growth_rate_30d, story_completion_rate };
}

async function computeTrustVerify(cookId) {
  const [row] = await sql`
    SELECT
      id_verified,
      verification_status,
      trust_score,
      EXTRACT(MONTH FROM AGE(NOW(), created_at)) AS tenure_months
    FROM cook_profiles WHERE id = ${cookId}
  `;

  const idVerified   = row?.id_verified ? 0.3 : 0;
  const approved     = row?.verification_status === 'approved' ? 0.3 : 0;
  const trustScore   = clamp((parseFloat(row?.trust_score) || 0) / 100) * 0.2;
  // Tenure saturates at 12 months
  const tenure       = saturate(parseFloat(row?.tenure_months) || 0, 12) * 0.2;

  const score = clamp(idVerified + approved + trustScore + tenure);
  return { score };
}

async function computeMarketplaceContrib(cookId) {
  const [row] = await sql`
    SELECT
      COALESCE(
        (
          SUM(cook_payout) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')
          - SUM(cook_payout) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days')
        ) / NULLIF(
          SUM(cook_payout) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'),
          0
        ), 0
      ) AS gmv_growth_rate_30d,
      COALESCE(
        COUNT(DISTINCT customer_id) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days'
          AND NOT EXISTS (
            SELECT 1 FROM orders o2
            WHERE o2.cook_id = ${cookId}
              AND o2.customer_id = orders.customer_id
              AND o2.created_at < NOW() - INTERVAL '30 days'
          )
        )::float /
        NULLIF(COUNT(DISTINCT customer_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0),
        0
      ) AS new_customer_rate_30d
    FROM orders
    WHERE cook_id = ${cookId} AND status = 'delivered'
  `;

  const gmv_growth_rate_30d  = clamp((parseFloat(row?.gmv_growth_rate_30d) || 0));
  const new_customer_rate_30d = clamp(parseFloat(row?.new_customer_rate_30d) || 0);

  // GMV growth of 50%+ month-over-month = full score
  const growScore = saturate(gmv_growth_rate_30d, 0.5);
  const score = clamp(growScore * 0.6 + new_customer_rate_30d * 0.4);

  return { score, gmv_growth_rate_30d, new_customer_rate_30d };
}

// ── Main recompute ─────────────────────────────────────────────────────────────

async function recomputeCreatorScore(cookId) {
  const [oq, rel, ca, ah, tv, mc] = await Promise.all([
    computeOrderQuality(cookId),
    computeReliability(cookId),
    computeContentActivity(cookId),
    computeAudienceHealth(cookId),
    computeTrustVerify(cookId),
    computeMarketplaceContrib(cookId),
  ]);

  const creator_score = Math.round((
    oq.score  * WEIGHTS.order_quality +
    rel.score * WEIGHTS.reliability +
    ca.score  * WEIGHTS.content_activity +
    ah.score  * WEIGHTS.audience_health +
    tv.score  * WEIGHTS.trust_verify +
    mc.score  * WEIGHTS.marketplace_contrib
  ) * 10000) / 10000;

  await sql`
    INSERT INTO creator_score_dimensions (
      cook_id,
      order_quality, reliability, content_activity, audience_health,
      trust_verify, marketplace_contrib, creator_score,
      avg_rating_90d, completion_rate_90d, repeat_order_rate,
      on_time_rate, response_rate, cancellation_rate,
      posts_per_week, stories_per_week,
      follower_to_order_conv, follower_growth_rate_30d, story_completion_rate,
      gmv_growth_rate_30d, new_customer_rate_30d,
      updated_at
    ) VALUES (
      ${cookId},
      ${oq.score}, ${rel.score}, ${ca.score}, ${ah.score},
      ${tv.score}, ${mc.score}, ${creator_score},
      ${oq.avg_rating_90d}, ${oq.completion_rate_90d}, ${oq.repeat_order_rate},
      ${rel.on_time_rate}, ${rel.response_rate}, ${rel.cancellation_rate},
      ${ca.posts_per_week}, ${ca.stories_per_week},
      ${ah.follower_to_order_conv}, ${ah.follower_growth_rate_30d}, ${ah.story_completion_rate},
      ${mc.gmv_growth_rate_30d}, ${mc.new_customer_rate_30d},
      NOW()
    )
    ON CONFLICT (cook_id) DO UPDATE SET
      order_quality        = EXCLUDED.order_quality,
      reliability          = EXCLUDED.reliability,
      content_activity     = EXCLUDED.content_activity,
      audience_health      = EXCLUDED.audience_health,
      trust_verify         = EXCLUDED.trust_verify,
      marketplace_contrib  = EXCLUDED.marketplace_contrib,
      creator_score        = EXCLUDED.creator_score,
      avg_rating_90d       = EXCLUDED.avg_rating_90d,
      completion_rate_90d  = EXCLUDED.completion_rate_90d,
      repeat_order_rate    = EXCLUDED.repeat_order_rate,
      on_time_rate         = EXCLUDED.on_time_rate,
      response_rate        = EXCLUDED.response_rate,
      cancellation_rate    = EXCLUDED.cancellation_rate,
      posts_per_week       = EXCLUDED.posts_per_week,
      stories_per_week     = EXCLUDED.stories_per_week,
      follower_to_order_conv    = EXCLUDED.follower_to_order_conv,
      follower_growth_rate_30d  = EXCLUDED.follower_growth_rate_30d,
      story_completion_rate     = EXCLUDED.story_completion_rate,
      gmv_growth_rate_30d       = EXCLUDED.gmv_growth_rate_30d,
      new_customer_rate_30d     = EXCLUDED.new_customer_rate_30d,
      updated_at           = NOW()
  `;

  return creator_score;
}

async function batchRecomputeAll() {
  const cooks = await sql`SELECT id FROM cook_profiles WHERE verification_status = 'approved'`;
  console.log(`[creatorScore] batch recomputing ${cooks.length} cooks`);

  let success = 0;
  let failed  = 0;
  for (const cook of cooks) {
    try {
      await recomputeCreatorScore(cook.id);
      success++;
    } catch (err) {
      failed++;
      console.error(`[creatorScore] failed for cook ${cook.id}:`, err.message);
    }
  }

  console.log(`[creatorScore] batch done: ${success} succeeded, ${failed} failed`);
  return { success, failed };
}

module.exports = { recomputeCreatorScore, batchRecomputeAll };
