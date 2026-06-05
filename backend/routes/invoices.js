const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

function nextInvoiceNumber() {
  return `INV-${Date.now()}`;
}

// ── POST /api/invoices — create invoice ───────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const {
      customer_id, order_id, catering_id,
      line_items, subtotal, discount_amount, tax_amount, total,
      currency, due_date, notes,
    } = req.body;

    if (!customer_id || !line_items || subtotal == null || total == null) {
      return res.status(400).json({ error: 'customer_id, line_items, subtotal, total required' });
    }

    const invoice_number = nextInvoiceNumber();
    const [invoice] = await sql`
      INSERT INTO invoices (
        invoice_number, cook_id, customer_id, order_id, catering_id,
        line_items, subtotal, discount_amount, tax_amount, total,
        currency, due_date, notes
      ) VALUES (
        ${invoice_number}, ${cooks[0].id}, ${customer_id},
        ${order_id ?? null}, ${catering_id ?? null},
        ${JSON.stringify(line_items)}::jsonb,
        ${subtotal}, ${discount_amount ?? 0}, ${tax_amount ?? 0}, ${total},
        ${currency ?? 'NGN'}, ${due_date ?? null}::date, ${notes ?? null}
      ) RETURNING *
    `;
    res.status(201).json({ invoice });
  } catch (err) {
    console.error('invoice create:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// ── GET /api/invoices — list caller's invoices ────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    let invoices;
    if (req.user.role === 'cook') {
      const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
      if (!cooks.length) return res.json({ invoices: [] });
      invoices = await sql`
        SELECT i.*, u.full_name AS customer_name
        FROM invoices i JOIN users u ON u.id = i.customer_id
        WHERE i.cook_id = ${cooks[0].id}
        ORDER BY i.created_at DESC
      `;
    } else {
      invoices = await sql`
        SELECT i.*, cp.display_name AS cook_name
        FROM invoices i JOIN cook_profiles cp ON cp.id = i.cook_id
        WHERE i.customer_id = ${req.user.id}
        ORDER BY i.created_at DESC
      `;
    }
    res.json({ invoices });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ── GET /api/invoices/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT i.*, u.full_name AS customer_name, u.phone AS customer_phone,
             cp.display_name AS cook_name
      FROM invoices i
      JOIN users u ON u.id = i.customer_id
      JOIN cook_profiles cp ON cp.id = i.cook_id
      WHERE i.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const isParty = inv.customer_id === req.user.id || inv.cook_id === cookRow[0]?.id;
    if (!isParty && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    if (req.user.role === 'cook') delete inv.customer_phone;

    res.json({ invoice: inv });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// ── PATCH /api/invoices/:id/send — mark as sent ───────────────────────────────
router.patch('/:id/send', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const [updated] = await sql`
      UPDATE invoices SET status = 'sent', updated_at = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id} AND status = 'draft'
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Invoice not found or already sent' });
    res.json({ invoice: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// ── PATCH /api/invoices/:id/paid — mark as paid (after FW success) ────────────
router.patch('/:id/paid', authenticate, async (req, res) => {
  try {
    const { tx_ref, paid_amount } = req.body;
    const rows = await sql`SELECT * FROM invoices WHERE id = ${req.params.id}`;
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = rows[0];

    const cookRow = req.user.role === 'cook'
      ? await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id} LIMIT 1`
      : [];
    const isParty = inv.customer_id === req.user.id || inv.cook_id === cookRow[0]?.id;
    if (!isParty) return res.status(403).json({ error: 'Access denied' });

    const amount = paid_amount ?? inv.total;
    const newStatus = amount >= inv.total ? 'paid' : 'partial';

    const [updated] = await sql`
      UPDATE invoices SET
        status = ${newStatus},
        paid_amount = ${amount},
        tx_ref = ${tx_ref ?? null},
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ invoice: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark invoice paid' });
  }
});

// ── DELETE /api/invoices/:id — delete draft ───────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const result = await sql`
      DELETE FROM invoices WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id} AND status = 'draft'
    `;
    if (!result.count) return res.status(404).json({ error: 'Invoice not found or cannot be deleted' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
