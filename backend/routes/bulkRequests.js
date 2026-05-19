const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

router.post('/', authenticate, async (req, res) => {
  try {
    const { cook_id, description, serving_count, preferred_date, delivery_address, delivery_latitude, delivery_longitude } = req.body;
    if (!cook_id || !description || !serving_count || !preferred_date) {
      return res.status(400).json({ error: 'cook_id, description, serving_count, and preferred_date required' });
    }

    const req_ = await sql`
      INSERT INTO bulk_requests (customer_id, cook_id, description, serving_count, preferred_date, delivery_address, delivery_latitude, delivery_longitude)
      VALUES (${req.user.id}, ${cook_id}, ${description}, ${serving_count}, ${preferred_date}::date,
              ${delivery_address ?? null}, ${delivery_latitude ?? null}, ${delivery_longitude ?? null})
      RETURNING *
    `;
    res.status(201).json({ request: req_[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send bulk request' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const isCook = req.user.role === 'cook';
    let requests;
    if (isCook) {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ requests: [] });
      requests = await sql`
        SELECT br.*, u.full_name AS customer_name FROM bulk_requests br
        JOIN users u ON u.id = br.customer_id WHERE br.cook_id = ${cooks[0].id}
        ORDER BY br.created_at DESC
      `;
    } else {
      requests = await sql`
        SELECT br.*, cp.display_name AS cook_name FROM bulk_requests br
        JOIN cook_profiles cp ON cp.id = br.cook_id WHERE br.customer_id = ${req.user.id}
        ORDER BY br.created_at DESC
      `;
    }
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bulk requests' });
  }
});

router.patch('/:id/quote', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { quote_amount, quote_message, deposit_percentage = 50 } = req.body;
    if (!quote_amount) return res.status(400).json({ error: 'quote_amount required' });

    const deposit = (quote_amount * deposit_percentage) / 100;
    const balance = quote_amount - deposit;

    const updated = await sql`
      UPDATE bulk_requests SET
        status = 'quoted', quote_amount = ${quote_amount},
        quote_message = ${quote_message ?? null}, quoted_at = NOW(),
        deposit_percentage = ${deposit_percentage},
        deposit_amount = ${deposit}, balance_amount = ${balance}
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated.length) return res.status(404).json({ error: 'Request not found' });
    res.json({ request: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to quote bulk request' });
  }
});

module.exports = router;
