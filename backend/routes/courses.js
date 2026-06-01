const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/courses — public listing ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { cook_id, category, difficulty, limit = 20, offset = 0 } = req.query;
    let courses;

    if (cook_id) {
      courses = await sql`
        SELECT c.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
        FROM courses c JOIN cook_profiles cp ON cp.id = c.cook_id
        WHERE c.cook_id = ${cook_id} AND c.is_published = true
        ORDER BY c.created_at DESC LIMIT ${+limit} OFFSET ${+offset}
      `;
    } else if (category) {
      courses = await sql`
        SELECT c.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
        FROM courses c JOIN cook_profiles cp ON cp.id = c.cook_id
        WHERE c.is_published = true AND c.category = ${category}
        ORDER BY c.enrollment_count DESC LIMIT ${+limit} OFFSET ${+offset}
      `;
    } else {
      courses = await sql`
        SELECT c.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar
        FROM courses c JOIN cook_profiles cp ON cp.id = c.cook_id
        WHERE c.is_published = true
        ORDER BY c.enrollment_count DESC LIMIT ${+limit} OFFSET ${+offset}
      `;
    }
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ── GET /api/courses/my — cook's own courses ─────────────────────────────────
router.get('/my', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.json({ courses: [] });
    const courses = await sql`
      SELECT * FROM courses WHERE cook_id = ${cooks[0].id} ORDER BY created_at DESC
    `;
    res.json({ courses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ── GET /api/courses/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const rows = await sql`
      SELECT c.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar, cp.bio AS cook_bio
      FROM courses c JOIN cook_profiles cp ON cp.id = c.cook_id
      WHERE c.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Course not found' });
    res.json({ course: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// ── POST /api/courses — create course ────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const {
      title, description, cover_image, price, difficulty_level,
      duration_hours, category, tags, lessons, is_free,
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title required' });

    const [course] = await sql`
      INSERT INTO courses (
        cook_id, title, description, cover_image, price, difficulty_level,
        duration_hours, category, tags, lessons, is_free,
        lesson_count
      ) VALUES (
        ${cooks[0].id}, ${title}, ${description ?? null},
        ${cover_image ?? null}, ${price ?? 0},
        ${difficulty_level ?? null}, ${duration_hours ?? null},
        ${category ?? null}, ${JSON.stringify(tags ?? [])}::text[],
        ${JSON.stringify(lessons ?? [])}::jsonb, ${is_free ?? false},
        ${(lessons ?? []).length}
      ) RETURNING *
    `;
    res.status(201).json({ course });
  } catch (err) {
    console.error('course create:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// ── PATCH /api/courses/:id — update course ────────────────────────────────────
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const fields = req.body;
    const allowed = [
      'title','description','cover_image','price','difficulty_level',
      'duration_hours','category','tags','lessons','is_free','is_published',
    ];

    const setClauses = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) {
        setClauses.push(k);
        vals.push(k === 'tags' ? JSON.stringify(v) : k === 'lessons' ? JSON.stringify(v) : v);
      }
    }
    if (!setClauses.length) return res.status(400).json({ error: 'No valid fields to update' });

    const lessonCount = fields.lessons ? fields.lessons.length : undefined;

    const [updated] = await sql`
      UPDATE courses SET
        title            = COALESCE(${fields.title ?? null}, title),
        description      = COALESCE(${fields.description ?? null}, description),
        cover_image      = COALESCE(${fields.cover_image ?? null}, cover_image),
        price            = COALESCE(${fields.price ?? null}, price),
        difficulty_level = COALESCE(${fields.difficulty_level ?? null}, difficulty_level),
        duration_hours   = COALESCE(${fields.duration_hours ?? null}, duration_hours),
        category         = COALESCE(${fields.category ?? null}, category),
        tags             = COALESCE(${fields.tags ? JSON.stringify(fields.tags) + '::text[]' : null}::text[], tags),
        lessons          = COALESCE(${fields.lessons ? JSON.stringify(fields.lessons) : null}::jsonb, lessons),
        lesson_count     = COALESCE(${lessonCount ?? null}, lesson_count),
        is_free          = COALESCE(${fields.is_free ?? null}, is_free),
        is_published     = COALESCE(${fields.is_published ?? null}, is_published),
        updated_at       = NOW()
      WHERE id = ${req.params.id} AND cook_id = ${cooks[0].id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Course not found' });
    res.json({ course: updated });
  } catch (err) {
    console.error('course update:', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// ── POST /api/courses/:id/enroll — enroll after payment ──────────────────────
router.post('/:id/enroll', authenticate, async (req, res) => {
  try {
    const { tx_ref, amount_paid } = req.body;
    const courses = await sql`SELECT * FROM courses WHERE id = ${req.params.id} AND is_published = true`;
    if (!courses.length) return res.status(404).json({ error: 'Course not found' });

    const [enroll] = await sql`
      INSERT INTO course_enrollments (course_id, user_id, tx_ref, amount_paid)
      VALUES (${req.params.id}, ${req.user.id}, ${tx_ref ?? null}, ${amount_paid ?? 0})
      ON CONFLICT (course_id, user_id) DO UPDATE SET tx_ref = EXCLUDED.tx_ref
      RETURNING *
    `;

    await sql`UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = ${req.params.id}`;

    res.status(201).json({ enrollment: enroll });
  } catch (err) {
    res.status(500).json({ error: 'Failed to enroll' });
  }
});

// ── GET /api/courses/:id/my-progress — enrolled user progress ────────────────
router.get('/:id/my-progress', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM course_enrollments
      WHERE course_id = ${req.params.id} AND user_id = ${req.user.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Not enrolled' });
    res.json({ enrollment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// ── PATCH /api/courses/:id/progress — update lesson progress ─────────────────
router.patch('/:id/progress', authenticate, async (req, res) => {
  try {
    const { progress } = req.body;
    if (typeof progress !== 'number') return res.status(400).json({ error: 'progress (0-100) required' });

    const [updated] = await sql`
      UPDATE course_enrollments SET
        progress = ${Math.min(100, Math.max(0, progress))},
        completed = ${progress >= 100},
        completed_at = CASE WHEN ${progress >= 100} THEN NOW() ELSE completed_at END
      WHERE course_id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Enrollment not found' });
    res.json({ enrollment: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

module.exports = router;
