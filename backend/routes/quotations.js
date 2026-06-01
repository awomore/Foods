const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

function nextQuoteNumber() {
  return `QUO-${Date.now()}`;
}

// ── POST /api/quotations ───────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const {
      customer_id, title, line_items, subtotal, discount_amount, total,
      currency, valid_until, notes,
    } = req.body;

    if (!customer_id || !line_items || subtotal == null || total == null) {
      return res.status(400).json({ error: 'customer_id, line_items, subtotal, total required' });
    }

    const [quote] = await sql`
      INSERT INTO quotations (
        quote_number, cook_id, customer_id, title,
        line_items, subtotal, discount_amount, total,
        currency, valid_until, notes
      ) VALUES (
        ${nextQuoteNumber()}, ${cooks[0].id}, ${customer_id}, ${title ?? null},
        ${JSON.stringify(line_items)}::jsonb,
        ${subtotal}, ${discount_amount ?? 0}, ${total},
        ${currency ?? 'NGN'}, ${valid_until ?? null}::date, ${notes ?? null}
      ) RETURNING *
    `;
    res.status(201).json({ quote });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create quotation' });
  }
});

// ── GET /api/quotations ───────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    let quotes;
    if (req.user.role === 'cook') {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ quotes: [] });
      quotes = await sql`
        SELECT q.*, u.full_name AS customer_name
        FROM quotations q JOIN users u ON u.id = q.customer_id
        WHERE q.cook_id = ${cooks[0].id}
        ORDER BY q.created_at DESC
      `;
    } else {
      quotes = await sql`
        SELECT q.*, cp.display_name AS cook_name
        FROM quotations q JOIN cook_profiles cp ON cp.id = q.cook_id
        WHERE q.customer_id = ${req.user.id}
        ORDER BY q.created_at DESC
      `;
    }
    res.json({ quotes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
});

// ── GET /api/quotations/:id ────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT q.*, u.full_name AS customer_name, cp.display_name AS cook_name
      FROM quotations q
      JOIN users u ON u.id = q.customer_id
      JOIN cook_profiles cp ON cp.id = q.cook_id
      WHERE q.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Quotation not found' });

    const q = rows[0];
    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const isParty = q.customer_id === req.user.id || q.cook_id === cookRow[0]?.id;
    if (!isParty && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    res.json({ quote: q });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quotation' });
  }
});

// ── PATCH /api/quotations/:id/send ────────────────────────────────────────────
router.patch('/:id/send', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const [updated] = await sql`
      UPDATE quotations SET status = 'sent', updated_at = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id} AND status = 'draft'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Quotation not found or already sent' });
    res.json({ quote: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send quotation' });
  }
});

// ── PATCH /api/quotations/:id/accept — customer accepts ──────────────────────
router.patch('/:id/accept', authenticate, async (req, res) => {
  try {
    const [updated] = await sql`
      UPDATE quotations SET status = 'accepted', updated_at = NOW()
      WHERE id = ${req.params.id} AND customer_id = ${req.user.id} AND status = 'sent'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Quotation not found or not in sent state' });
    res.json({ quote: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept quotation' });
  }
});

// ── PATCH /api/quotations/:id/reject ─────────────────────────────────────────
router.patch('/:id/reject', authenticate, async (req, res) => {
  try {
    const [updated] = await sql`
      UPDATE quotations SET status = 'rejected', updated_at = NOW()
      WHERE id = ${req.params.id} AND customer_id = ${req.user.id} AND status = 'sent'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Quotation not found' });
    res.json({ quote: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject quotation' });
  }
});

// ── POST /api/quotations/:id/convert — cook converts quote to invoice ─────────
router.post('/:id/convert', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const quotes = await sql`SELECT * FROM quotations WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}`;
    if (!quotes.length) return res.status(404).json({ error: 'Quotation not found' });
    const quote = quotes[0];

    const { due_date, tax_amount } = req.body;

    // Create invoice from quote
    const invoice_number = `INV-${Date.now()}`;
    const [invoice] = await sql`
      INSERT INTO invoices (
        invoice_number, cook_id, customer_id,
        line_items, subtotal, discount_amount, tax_amount, total,
        currency, due_date, notes
      ) VALUES (
        ${invoice_number}, ${cooks[0].id}, ${quote.customer_id},
        ${JSON.stringify(quote.line_items)}::jsonb,
        ${quote.subtotal}, ${quote.discount_amount}, ${tax_amount ?? 0}, ${quote.total},
        ${quote.currency}, ${due_date ?? null}::date, ${quote.notes ?? null}
      ) RETURNING *
    `;

    await sql`
      UPDATE quotations SET
        status = 'converted',
        invoice_id = ${invoice.id},
        converted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${req.params.id}
    `;

    res.status(201).json({ invoice, quote_id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to convert quotation' });
  }
});

module.exports = router;
