const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

const CERT_TYPES = [
  'food_safety_certificate',
  'health_certificate',
  'cac_registration',
  'culinary_certification',
  'nafdac_approval',
  'government_permit',
];

// ── GET /api/certifications/mine ────────────────────────────────────────────
router.get('/mine', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const submissions = await sql`
      SELECT * FROM verification_submissions
      WHERE cook_id = ${cooks[0].id}
      ORDER BY submitted_at DESC
    `;
    res.json({ submissions });
  } catch (err) {
    console.error('GET /certifications/mine:', err);
    res.status(500).json({ error: 'Failed to fetch certifications' });
  }
});

// ── POST /api/certifications ─────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cookId = cooks[0].id;

    const { type, title, institution, document_url, expires_at } = req.body;
    if (!type || !CERT_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid certification type' });
    }
    if (!document_url) {
      return res.status(400).json({ error: 'document_url is required' });
    }

    const sub = await sql`
      INSERT INTO verification_submissions (cook_id, type, title, institution, document_url, expires_at)
      VALUES (
        ${cookId}, ${type}, ${title ?? null}, ${institution ?? null},
        ${document_url}, ${expires_at ?? null}::date
      )
      RETURNING *
    `;
    res.status(201).json({ submission: sub[0] });
  } catch (err) {
    console.error('POST /certifications:', err);
    res.status(500).json({ error: 'Failed to submit certification' });
  }
});

// ── DELETE /api/certifications/:id ──────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const subs = await sql`
      SELECT cook_id, status FROM verification_submissions WHERE id = ${req.params.id}
    `;
    if (!subs.length) return res.status(404).json({ error: 'Not found' });
    if (subs[0].cook_id !== cooks[0].id) return res.status(403).json({ error: 'Forbidden' });
    if (subs[0].status === 'approved') {
      return res.status(400).json({ error: 'Cannot delete an approved certification' });
    }

    await sql`DELETE FROM verification_submissions WHERE id = ${req.params.id}`;
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete certification' });
  }
});

// ── GET /api/certifications/cook/:cookId ────────────────────────────────────
// Public: only approved submissions
router.get('/cook/:cookId', async (req, res) => {
  try {
    const submissions = await sql`
      SELECT id, type, title, institution, status, submitted_at, expires_at
      FROM verification_submissions
      WHERE cook_id = ${req.params.cookId} AND status = 'approved'
      ORDER BY submitted_at DESC
    `;
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch certifications' });
  }
});

// ── PATCH /api/certifications/:id/review ─────────────────────────────────── (admin)
router.patch('/:id/review', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { status, review_notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }

    const updated = await sql`
      UPDATE verification_submissions
      SET
        status       = ${status},
        review_notes = ${review_notes ?? null},
        reviewed_at  = NOW(),
        reviewed_by  = ${req.user.id},
        updated_at   = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    if (!updated.length) return res.status(404).json({ error: 'Not found' });

    res.json({ submission: updated[0] });
  } catch (err) {
    console.error('PATCH /certifications/:id/review:', err);
    res.status(500).json({ error: 'Failed to review certification' });
  }
});

module.exports = router;
