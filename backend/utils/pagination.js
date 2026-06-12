'use strict';

const MAX_LIMIT = 100;

/**
 * Extract safe, capped pagination params from an Express req.query.
 * Returns { limit, offset } with limit clamped to [1, MAX_LIMIT].
 */
function paginate(query, defaultLimit = 20) {
  const limit  = Math.min(Math.max(1, parseInt(query.limit)  || defaultLimit), MAX_LIMIT);
  const offset = Math.max(0, parseInt(query.offset) || 0);
  return { limit, offset };
}

module.exports = { paginate, MAX_LIMIT };
