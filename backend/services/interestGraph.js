'use strict';

const { sql } = require('../supabase/db');

// Exponential moving average: blend old affinity with new signal
// alpha=0.15 means recent orders get 15% weight, history retains 85%
const EMA_ALPHA = 0.15;

function blendAffinity(old, signal) {
  return Math.max(0, Math.min(1, old * (1 - EMA_ALPHA) + signal * EMA_ALPHA));
}

async function getOrCreateGraph(userId) {
  const rows = await sql`
    SELECT * FROM customer_interest_graphs WHERE user_id = ${userId}
  `;
  if (rows[0]) return rows[0];

  // Bootstrap from onboarding preferences if they exist
  const prefs = await sql`
    SELECT cuisine FROM user_cuisine_preferences WHERE user_id = ${userId}
  `;
  const cuisineAffinities = {};
  for (const p of prefs) {
    cuisineAffinities[p.cuisine] = 0.7; // onboarding prefs start strong
  }

  const [newGraph] = await sql`
    INSERT INTO customer_interest_graphs (user_id, cuisine_affinities)
    VALUES (${userId}, ${JSON.stringify(cuisineAffinities)}::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING *
  `;
  return newGraph;
}

async function _updateCuisineAffinity(userId, cuisine, signalStrength) {
  if (!cuisine) return;
  const graph = await getOrCreateGraph(userId);
  const affinities = graph.cuisine_affinities ?? {};
  const oldAffinity = affinities[cuisine] ?? 0;
  const newAffinity = blendAffinity(oldAffinity, signalStrength);
  affinities[cuisine] = Math.round(newAffinity * 1000) / 1000;

  await sql`
    UPDATE customer_interest_graphs
    SET cuisine_affinities = ${JSON.stringify(affinities)}::jsonb,
        updated_at = NOW()
    WHERE user_id = ${userId}
  `;
}

/**
 * Class A signal (strength 1.0): completed order
 * Updates cuisine affinity and price band.
 */
async function updateFromOrder(userId, order) {
  const cuisine = order.cuisine_type?.toLowerCase();
  await _updateCuisineAffinity(userId, cuisine, 1.0);

  // Update price band from order history (rolling percentile)
  if (order.unit_price) {
    await sql`
      UPDATE customer_interest_graphs
      SET price_band_min = LEAST(price_band_min, ${order.unit_price} * 0.7),
          price_band_max = GREATEST(price_band_max, ${order.unit_price} * 1.5),
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  }
}

/**
 * Class B signal (strength 0.3): profile view
 */
async function updateFromProfileView(userId, cookId) {
  const rows = await sql`
    SELECT cuisine_types[1] AS cuisine FROM cook_profiles WHERE id = ${cookId}
  `;
  const cuisine = rows[0]?.cuisine?.toLowerCase();
  await _updateCuisineAffinity(userId, cuisine, 0.3);
}

/**
 * Class B signal (strength 0.35): story fully watched
 */
async function updateFromStoryComplete(userId, cookId) {
  const rows = await sql`
    SELECT cuisine_types[1] AS cuisine FROM cook_profiles WHERE id = ${cookId}
  `;
  const cuisine = rows[0]?.cuisine?.toLowerCase();
  await _updateCuisineAffinity(userId, cuisine, 0.35);
}

/**
 * Class C signal (strength -0.1): card skip / disinterest
 */
async function updateFromSkip(userId, cookId) {
  const rows = await sql`
    SELECT cuisine_types[1] AS cuisine FROM cook_profiles WHERE id = ${cookId}
  `;
  const cuisine = rows[0]?.cuisine?.toLowerCase();
  if (cuisine) {
    await _updateCuisineAffinity(userId, cuisine, -0.1);
  }
}

/**
 * Class C signal (strength 0.25): search query
 * Uses the query string as a cuisine proxy (rough intent signal).
 */
async function updateFromSearch(userId, query) {
  if (!query || query.length < 2) return;
  const normalized = query.toLowerCase().trim();
  await _updateCuisineAffinity(userId, normalized, 0.25);
}

async function getCuisineAffinities(userId) {
  const graph = await getOrCreateGraph(userId);
  const affinities = graph.cuisine_affinities ?? {};
  return Object.entries(affinities)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
}

async function getPriceBand(userId) {
  const graph = await getOrCreateGraph(userId);
  return {
    min: graph.price_band_min ?? 0,
    max: graph.price_band_max ?? 999999,
  };
}

/**
 * Save explicit onboarding cuisine preferences server-side.
 * Called when the user completes the preference screen.
 */
async function saveOnboardingPreferences(userId, cuisines = [], dietary = []) {
  // Upsert into explicit preferences table
  for (const cuisine of cuisines) {
    await sql`
      INSERT INTO user_cuisine_preferences (user_id, cuisine, source)
      VALUES (${userId}, ${cuisine.toLowerCase()}, 'onboarding')
      ON CONFLICT (user_id, cuisine) DO NOTHING
    `;
  }

  // Bootstrap interest graph from explicit preferences
  const initialAffinities = {};
  for (const cuisine of cuisines) {
    initialAffinities[cuisine.toLowerCase()] = 0.7;
  }

  await sql`
    INSERT INTO customer_interest_graphs (user_id, cuisine_affinities)
    VALUES (${userId}, ${JSON.stringify(initialAffinities)}::jsonb)
    ON CONFLICT (user_id) DO UPDATE
      SET cuisine_affinities = ${JSON.stringify(initialAffinities)}::jsonb,
          updated_at = NOW()
  `;

  return { cuisines, dietary };
}

module.exports = {
  getOrCreateGraph,
  updateFromOrder,
  updateFromProfileView,
  updateFromStoryComplete,
  updateFromSkip,
  updateFromSearch,
  getCuisineAffinities,
  getPriceBand,
  saveOnboardingPreferences,
};
