const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { sql } = require('../supabase/db');

// TODO: implement routes
router.get('/', authenticate, (req, res) => {
  res.json({ message: 'Route not yet implemented' });
});

module.exports = router;
