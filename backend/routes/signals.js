'use strict';

const express = require('express');
const router  = express.Router();
const { optionalAuth } = require('../middleware/auth');
const signalSvc        = require('../services/signals');

const VALID_ENTITY_TYPES = ['cook', 'dish', 'story', 'post', 'course'];
const VALID_SIGNAL_TYPES = [
  'profile_view', 'story_complete', 'story_skip', 'card_skip', 'craving_submit',
];

// ── POST /api/signals ─────────────────────────────────────────────────────────
// Receives client-side behavioral signals from the mobile app.
// Order signals are emitted server-side after order completion, not here.
router.post('/', optionalAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { entity_type, entity_id, signal_type } = req.body;

  if (!VALID_ENTITY_TYPES.includes(entity_type)) {
    return res.status(400).json({ error: 'Invalid entity_type' });
  }
  if (!VALID_SIGNAL_TYPES.includes(signal_type)) {
    return res.status(400).json({ error: 'Invalid signal_type' });
  }
  if (!entity_id && signal_type !== 'craving_submit') {
    return res.status(400).json({ error: 'entity_id required' });
  }

  // Fire-and-forget: don't block the response waiting for DB write
  signalSvc.emit(userId, entity_type, entity_id ?? null, signal_type).catch(err =>
    console.error('[signals route] emit error:', err.message)
  );

  res.json({ ok: true });
});

module.exports = router;
