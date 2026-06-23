'use strict';

const { sql } = require('../supabase/db');

// Decay windows per signal type (in days)
const DECAY_WINDOWS = {
  order:           90,
  repeat_order:    90,
  follow:          90,
  craving:         30,
  story_complete:  14,
  profile_view:     7,
  search:           7,
  skip:             7,
  card_skip:        7,
  story_skip:       7,
};

// Signal strength per type (positive = interest, negative = disinterest)
const SIGNAL_STRENGTH = {
  order:           1.0,
  repeat_order:    1.0,
  follow:          0.5,
  craving:         0.4,
  story_complete:  0.35,
  profile_view:    0.3,
  search:          0.25,
  skip:           -0.1,
  card_skip:      -0.1,
  story_skip:     -0.05,
};

/**
 * Emit a behavioral signal for a user→entity interaction.
 * Writes to user_interaction_signals and queues an async interest graph update.
 */
async function emit(userId, entityType, entityId, signalType) {
  const strength = SIGNAL_STRENGTH[signalType] ?? 1.0;
  const decayDays = DECAY_WINDOWS[signalType] ?? 30;
  const expiresAt = new Date(Date.now() + decayDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    await sql`
      INSERT INTO user_interaction_signals
        (user_id, entity_type, entity_id, signal_type, signal_strength, expires_at)
      VALUES
        (${userId}, ${entityType}, ${entityId}, ${signalType}, ${strength}, ${expiresAt})
    `;

    // Fire-and-forget interest graph update
    setImmediate(() => {
      updateInterestGraph(userId, entityType, entityId, signalType, strength).catch(err =>
        console.error('[signals] interest graph update failed:', err.message)
      );
    });
  } catch (err) {
    console.error('[signals] emit failed:', err.message);
  }
}

// Lazy require to avoid circular dependency (interestGraph requires signals)
async function updateInterestGraph(userId, entityType, entityId, signalType, strength) {
  const ig = require('./interestGraph');
  try {
    if (signalType === 'order' || signalType === 'repeat_order') {
      const rows = await sql`SELECT cook_id, cuisine_type FROM menu_items WHERE id = ${entityId} LIMIT 1`;
      if (rows[0]) await ig.updateFromOrder(userId, rows[0]);
    } else if (signalType === 'profile_view') {
      await ig.updateFromProfileView(userId, entityId);
    } else if (signalType === 'story_complete') {
      await ig.updateFromStoryComplete(userId, entityId);
    } else if (signalType === 'skip' || signalType === 'card_skip') {
      await ig.updateFromSkip(userId, entityId);
    } else if (signalType === 'search') {
      // entityId is null for search; entity_type carries the query
      await ig.updateFromSearch(userId, entityType);
    }
  } catch (err) {
    console.error('[signals] graph update error:', err.message);
  }
}

/**
 * Daily cleanup: remove expired signals to keep the table lean.
 */
async function cleanupExpiredSignals() {
  const result = await sql`
    DELETE FROM user_interaction_signals WHERE expires_at < NOW()
  `;
  const deleted = result.count ?? 0;
  console.log(`[signals] cleaned up ${deleted} expired signal(s)`);
  return deleted;
}

module.exports = { emit, cleanupExpiredSignals };
