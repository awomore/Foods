'use strict';

// ── Distance decay ─────────────────────────────────────────────────────────────
function distanceDecay(km) {
  if (!km || km <= 5)  return 1.0;
  if (km <= 15) return 0.8;
  if (km <= 25) return 0.6;
  if (km <= 40) return 0.4;
  if (km <= 80) return 0.2;
  return 0.0;
}

// Clamp to [0, 1]
const clamp = v => Math.max(0, Math.min(1, v ?? 0));

// ── Feed scoring ───────────────────────────────────────────────────────────────

/**
 * Score a cook card for the home "For You" feed.
 *
 * Weights:
 *   creator_score   40%
 *   cuisine_match   25%
 *   order_history   20%   (has user ordered from this cook before?)
 *   availability    10%   (live or has menu today)
 *   debut_boost      5%   (phase 1/2 creators get guaranteed discovery)
 */
function scoreFeed(cook, userGraph, userLocation) {
  const creatorScore = clamp(cook.creator_score ?? 0);

  // Cuisine match: top affinity cuisine matching cook's listed cuisines
  let cuisineMatch = 0;
  if (userGraph && cook.cuisine_types?.length) {
    const affinities = userGraph.cuisine_affinities ?? {};
    for (const cuisine of cook.cuisine_types) {
      const aff = affinities[cuisine?.toLowerCase()] ?? 0;
      cuisineMatch = Math.max(cuisineMatch, aff);
    }
    // Also check today's menu items
    if (cook.today_items?.length && cook.today_items[0]?.cuisine_type) {
      const menuCuisine = cook.today_items[0].cuisine_type.toLowerCase();
      const menuAff = affinities[menuCuisine] ?? 0;
      cuisineMatch = Math.max(cuisineMatch, menuAff);
    }
  }

  // Order history: 1.0 if user has ordered from this cook before
  const orderHistory = cook._has_ordered ? 1.0 : 0.0;

  // Availability: live=1.0, has_menu_today=0.7, neither=0.0
  const availability = cook.is_live ? 1.0 : (cook.today_items?.length > 0 ? 0.7 : 0.0);

  // Debut boost: phase 1 or 2 creators get a score floor
  const debutBoost = cook._debut_phase === 1 ? 1.0 : cook._debut_phase === 2 ? 0.5 : 0.0;

  // Distance decay applied as a multiplier on geo-dependent signals
  const geo = userLocation ? distanceDecay(cook.distance_km) : 0.5;

  const raw = (
    creatorScore  * 0.40 +
    cuisineMatch  * 0.25 +
    orderHistory  * 0.20 +
    availability  * 0.10 +
    debutBoost    * 0.05
  );

  // Apply geo as a mild multiplier (never zeros out a creator, just reduces them)
  return clamp(raw * (0.6 + geo * 0.4));
}

// ── Anti-monopoly filter ───────────────────────────────────────────────────────

/**
 * Enforce diversity rules on a ranked list of cook cards.
 *
 * Rules:
 * - Max 2 cards from the same cook per 20-card window
 * - Max 5 cards from the same cuisine type per 20-card window
 * - Every 10th slot reserved for a long-tail creator (debut phase 1/2)
 */
function applyAntiMonopoly(rankedList) {
  const result = [];
  const cookCount   = {};
  const cuisineCount = {};
  let longTailBuffer = []; // debut creators excluded from main flow
  let main = [...rankedList];

  // Separate debut creators into buffer
  main = main.filter(cook => {
    if (cook._debut_phase === 1 || cook._debut_phase === 2) {
      longTailBuffer.push(cook);
      return false;
    }
    return true;
  });

  let slot = 0;
  let mainIdx = 0;
  let ltIdx   = 0;

  while (result.length < rankedList.length && (mainIdx < main.length || ltIdx < longTailBuffer.length)) {
    slot++;

    // Every 10th slot: inject a long-tail/debut creator
    if (slot % 10 === 0 && ltIdx < longTailBuffer.length) {
      result.push(longTailBuffer[ltIdx++]);
      continue;
    }

    // Find next main-list cook that passes diversity rules
    let inserted = false;
    while (mainIdx < main.length) {
      const cook = main[mainIdx++];
      const cookId = cook.id;
      const cuisine = cook.cuisine_types?.[0] ?? 'other';

      if ((cookCount[cookId] ?? 0) >= 2) continue;
      if ((cuisineCount[cuisine] ?? 0) >= 5) continue;

      cookCount[cookId]    = (cookCount[cookId]   ?? 0) + 1;
      cuisineCount[cuisine] = (cuisineCount[cuisine] ?? 0) + 1;
      result.push(cook);
      inserted = true;
      break;
    }

    if (!inserted) {
      // Main list exhausted — drain long-tail
      if (ltIdx < longTailBuffer.length) result.push(longTailBuffer[ltIdx++]);
    }
  }

  return result;
}

// ── Discover dish scoring ──────────────────────────────────────────────────────

/**
 * Score a dish for the Discover page.
 *
 * fts_rank    35%  — PostgreSQL full-text rank (search relevance)
 * creator_score 25%  — quality signal of the creator
 * dish_orders  15%  — 90-day completed order velocity (normalised 0–1)
 * price_fit    10%  — within user's inferred price band
 * availability 10%  — available today
 * cuisine_match 5%  — cuisine affinity match
 */
function scoreDiscover(dish, userGraph) {
  const ftsRank     = clamp(dish._fts_rank ?? 0);
  const creatorScore = clamp(dish.cook_creator_score ?? dish.cook_rating / 5 ?? 0);
  // order_count_90d: normalise against a threshold of 50 orders
  const dishOrders  = Math.min((dish.order_count_90d ?? 0) / 50, 1);
  const availability = dish.available_date === new Date().toISOString().slice(0, 10)
    || dish.realtime_available ? 1.0 : 0.3;

  let cuisineMatch = 0;
  if (userGraph) {
    const affinities = userGraph.cuisine_affinities ?? {};
    const c = dish.cuisine_type?.toLowerCase();
    if (c) cuisineMatch = clamp(affinities[c] ?? 0);
  }

  let priceFit = 0.5; // neutral if no price band data
  if (userGraph && dish.unit_price) {
    const min = userGraph.price_band_min ?? 0;
    const max = userGraph.price_band_max ?? 999999;
    priceFit = dish.unit_price >= min && dish.unit_price <= max ? 1.0 : 0.2;
  }

  return clamp(
    ftsRank      * 0.35 +
    creatorScore * 0.25 +
    dishOrders   * 0.15 +
    priceFit     * 0.10 +
    availability * 0.10 +
    cuisineMatch * 0.05
  );
}

// ── Story group scoring ────────────────────────────────────────────────────────

/**
 * Score a story group (grouped by cook) for the stories bar.
 *
 * has_unseen   50%
 * is_live      30%
 * completion_rate 15%  (how often this user completes this cook's stories)
 * past_ordered  5%
 */
function scoreStory(storyGroup) {
  const hasUnseen         = storyGroup.has_unseen          ? 1.0 : 0.0;
  const isLive            = storyGroup.cook?.is_live        ? 1.0 : 0.0;
  const completionRate    = clamp(storyGroup._completion_rate ?? 0);
  const pastOrdered       = storyGroup._has_ordered         ? 1.0 : 0.0;

  return clamp(
    hasUnseen      * 0.50 +
    isLive         * 0.30 +
    completionRate * 0.15 +
    pastOrdered    * 0.05
  );
}

module.exports = {
  distanceDecay,
  scoreFeed,
  applyAntiMonopoly,
  scoreDiscover,
  scoreStory,
};
