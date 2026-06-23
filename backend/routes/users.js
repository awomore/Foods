const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const interestGraph = require('../services/interestGraph');

// ── POST /api/users/preferences ────────────────────────────────────────────
// Saves onboarding cuisine selections server-side, bootstrapping the interest graph.
router.post('/preferences', authenticate, async (req, res) => {
  try {
    const { cuisines = [], dietary = [] } = req.body;
    if (!Array.isArray(cuisines)) {
      return res.status(400).json({ error: 'cuisines must be an array' });
    }
    await interestGraph.saveOnboardingPreferences(req.user.id, cuisines, dietary);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;
