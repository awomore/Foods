const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');

// ── GET /api/reliability/me — caller's own reliability score ──────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const role = req.user.role === 'cook' ? 'cook' : 'customer';
    const rows = await sql`
      SELECT * FROM reliability_scores
      WHERE user_id = ${req.user.id} AND role = ${role}
    `;

    if (!rows.length) {
      return res.json({
        score: 100,
        role,
        on_time_deliveries:  0,
        late_deliveries:     0,
        cancellations:       0,
        no_shows:            0,
        disputes_raised:     0,
        disputes_received:   0,
        disputes_won:        0,
        disputes_lost:       0,
        total_orders:        0,
        last_computed_at:    null,
        breakdown:           _buildBreakdown(null),
      });
    }

    const r = rows[0];
    res.json({ ...r, score: parseFloat(r.score), breakdown: _buildBreakdown(r) });
  } catch (err) {
    console.error('GET /reliability/me:', err);
    res.status(500).json({ error: 'Failed to fetch reliability score' });
  }
});

// ── GET /api/reliability/user/:userId — admin or self view ────────────────────
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const rows = await sql`
      SELECT * FROM reliability_scores WHERE user_id = ${req.params.userId}
    `;
    res.json({ scores: rows.map(r => ({ ...r, score: parseFloat(r.score) })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reliability scores' });
  }
});

// ── GET /api/reliability/leaderboard — top reliable cooks (public) ─────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const rows = await sql`
      SELECT rs.score, rs.on_time_deliveries, rs.total_orders,
             cp.display_name, cp.avatar_url, cp.username, cp.average_rating
      FROM reliability_scores rs
      JOIN users u ON u.id = rs.user_id
      JOIN cook_profiles cp ON cp.user_id = rs.user_id
      WHERE rs.role = 'cook'
        AND rs.total_orders >= 5
        AND cp.is_active = true
      ORDER BY rs.score DESC, rs.total_orders DESC
      LIMIT ${+limit}
    `;
    res.json({ leaderboard: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ── GET /api/reliability/admin/all — admin: all scores with risk flags ─────────
router.get('/admin/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { role, min_score, max_score, limit = 50, offset = 0 } = req.query;

    const rows = await sql`
      SELECT rs.*, u.full_name, u.phone, u.account_risk_level,
             rs.score::numeric AS score
      FROM reliability_scores rs
      JOIN users u ON u.id = rs.user_id
      WHERE (${role ? sql`rs.role = ${role}` : sql`TRUE`})
        AND (${min_score ? sql`rs.score >= ${+min_score}` : sql`TRUE`})
        AND (${max_score ? sql`rs.score <= ${+max_score}` : sql`TRUE`})
      ORDER BY rs.score ASC, rs.total_orders DESC
      LIMIT ${+limit} OFFSET ${+offset}
    `;
    const total = await sql`SELECT COUNT(*) FROM reliability_scores WHERE (${role ? sql`role = ${role}` : sql`TRUE`})`;
    res.json({ scores: rows, total: Number(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// ── POST /api/reliability/compute/:userId — recompute score for a user ─────────
// Called internally (after each order/dispute settlement) or by admin
router.post('/compute/:userId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const results = await _recompute(req.params.userId);
    res.json({ updated: results });
  } catch (err) {
    console.error('POST /reliability/compute:', err);
    res.status(500).json({ error: 'Failed to recompute score' });
  }
});

// ── POST /api/reliability/compute-worker — batch recompute (worker secret) ────
router.post('/compute-worker', async (req, res) => {
  const secret = req.headers['x-worker-secret'];
  if (secret !== process.env.WORKER_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Recompute for all users with orders in the last 7 days
    const activeUsers = await sql`
      SELECT DISTINCT customer_id AS user_id FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION
      SELECT DISTINCT u.id FROM cook_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.updated_at >= NOW() - INTERVAL '7 days'
    `;

    let updated = 0;
    for (const row of activeUsers) {
      await _recompute(row.user_id).catch(() => {});
      updated++;
    }
    res.json({ updated });
  } catch (err) {
    console.error('compute-worker error:', err);
    res.status(500).json({ error: 'Batch compute failed' });
  }
});

// ── Internals ─────────────────────────────────────────────────────────────────

async function _recompute(userId) {
  const results = [];

  // User role
  const users = await sql`SELECT role FROM users WHERE id = ${userId}`;
  if (!users.length) return results;
  const userRole = users[0].role;

  if (userRole === 'cook') {
    const cookRows = await sql`SELECT id FROM cook_profiles WHERE user_id = ${userId}`;
    if (!cookRows.length) return results;
    const cookId = cookRows[0].id;

    const [orderStats, disputeStats, slaStats] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('delivered','completed')) AS total_completed,
          COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_by = 'cook') AS cancellations
        FROM orders WHERE cook_id = ${cookId}
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'resolved' AND resolution_type = 'no_refund') AS disputes_won,
          COUNT(*) FILTER (WHERE status = 'resolved' AND resolution_type IN ('full_refund','partial_refund')) AS disputes_lost,
          COUNT(*) AS disputes_received
        FROM disputes WHERE cook_id = ${cookId}
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE minutes_late = 0 OR minutes_late IS NULL) AS on_time,
          COUNT(*) FILTER (WHERE minutes_late > 0) AS late_count
        FROM sla_events
        WHERE entity_type = 'order' AND event_type = 'delivery_late'
          AND entity_id IN (SELECT id FROM orders WHERE cook_id = ${cookId})
      `,
    ]);

    const o = orderStats[0];
    const d = disputeStats[0];
    const s = slaStats[0];

    const totalOrders    = parseInt(o.total_completed ?? 0);
    const cancellations  = parseInt(o.cancellations ?? 0);
    const disputesWon    = parseInt(d.disputes_won ?? 0);
    const disputesLost   = parseInt(d.disputes_lost ?? 0);
    const disputesRcv    = parseInt(d.disputes_received ?? 0);
    const lateDeliveries = parseInt(s.late_count ?? 0);
    const onTime         = totalOrders - lateDeliveries;

    const score = await sql`
      SELECT compute_reliability_score(
        ${onTime}, ${lateDeliveries}, ${cancellations}, 0, ${disputesLost}, ${totalOrders}
      ) AS score
    `;
    const newScore = parseFloat(score[0].score ?? 100);

    const [upserted] = await sql`
      INSERT INTO reliability_scores (
        user_id, role, score,
        on_time_deliveries, late_deliveries, cancellations,
        disputes_received, disputes_won, disputes_lost, total_orders,
        last_computed_at
      ) VALUES (
        ${userId}, 'cook', ${newScore},
        ${onTime}, ${lateDeliveries}, ${cancellations},
        ${disputesRcv}, ${disputesWon}, ${disputesLost}, ${totalOrders},
        NOW()
      )
      ON CONFLICT (user_id, role) DO UPDATE SET
        score                = EXCLUDED.score,
        on_time_deliveries   = EXCLUDED.on_time_deliveries,
        late_deliveries      = EXCLUDED.late_deliveries,
        cancellations        = EXCLUDED.cancellations,
        disputes_received    = EXCLUDED.disputes_received,
        disputes_won         = EXCLUDED.disputes_won,
        disputes_lost        = EXCLUDED.disputes_lost,
        total_orders         = EXCLUDED.total_orders,
        last_computed_at     = NOW(),
        updated_at           = NOW()
      RETURNING *
    `;

    // Mirror to cook_profiles for search ranking
    await sql`
      UPDATE cook_profiles SET reliability_score = ${newScore} WHERE user_id = ${userId}
    `;

    results.push({ role: 'cook', score: newScore });
  }

  if (userRole === 'customer' || userRole === 'cook') {
    const role = 'customer';
    const [orderStats, disputeStats] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('delivered','completed')) AS total_completed,
          COUNT(*) FILTER (WHERE status = 'cancelled' AND cancelled_by = 'customer') AS cancellations
        FROM orders WHERE customer_id = ${userId}
      `,
      sql`
        SELECT COUNT(*) AS disputes_raised
        FROM disputes WHERE customer_id = ${userId}
      `,
    ]);

    const o = orderStats[0];
    const d = disputeStats[0];
    const totalOrders   = parseInt(o.total_completed ?? 0);
    const cancellations = parseInt(o.cancellations ?? 0);
    const disputesRaised = parseInt(d.disputes_raised ?? 0);

    const score = await sql`
      SELECT compute_reliability_score(
        ${totalOrders - cancellations}, 0, ${cancellations}, 0, ${Math.floor(disputesRaised * 0.3)}, ${totalOrders}
      ) AS score
    `;
    const newScore = parseFloat(score[0].score ?? 100);

    await sql`
      INSERT INTO reliability_scores (
        user_id, role, score,
        cancellations, disputes_raised, total_orders, last_computed_at
      ) VALUES (
        ${userId}, ${role}, ${newScore},
        ${cancellations}, ${disputesRaised}, ${totalOrders}, NOW()
      )
      ON CONFLICT (user_id, role) DO UPDATE SET
        score            = EXCLUDED.score,
        cancellations    = EXCLUDED.cancellations,
        disputes_raised  = EXCLUDED.disputes_raised,
        total_orders     = EXCLUDED.total_orders,
        last_computed_at = NOW(),
        updated_at       = NOW()
    `;

    results.push({ role: 'customer', score: newScore });
  }

  return results;
}

function _buildBreakdown(r) {
  if (!r) return [
    { label: 'On-Time Deliveries', value: '—', weight: 40 },
    { label: 'Cancellation Rate',  value: '—', weight: 30 },
    { label: 'Dispute Rate',       value: '—', weight: 20 },
    { label: 'No-Show Rate',       value: '—', weight: 10 },
  ];

  const total = r.total_orders || 1;
  return [
    { label: 'On-Time Deliveries', value: `${r.on_time_deliveries}/${total}`, weight: 40 },
    { label: 'Cancellation Rate',  value: `${((r.cancellations / total) * 100).toFixed(1)}%`, weight: 30 },
    { label: 'Dispute Rate',       value: `${(((r.disputes_received ?? r.disputes_raised ?? 0) / total) * 100).toFixed(1)}%`, weight: 20 },
    { label: 'No-Show Rate',       value: `${((r.no_shows / total) * 100).toFixed(1)}%`, weight: 10 },
  ];
}

module.exports = router;
module.exports._recompute = _recompute;
