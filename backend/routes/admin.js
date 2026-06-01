const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

const { sql } = require('../supabase/db');

const guard = [authenticate, roleGuard('admin')];

// ── Stats ────────────────────────────────────────────────────

router.get('/stats', ...guard, async (req, res) => {
  try {
    const [users, cooks, orders, revenue, pendingPayouts, pendingVerifications] = await Promise.all([
      sql`SELECT COUNT(*) FROM users WHERE is_active = true`,
      sql`SELECT COUNT(*) FROM cooks WHERE is_active = true`,
      sql`SELECT COUNT(*), status FROM orders GROUP BY status`,
      sql`SELECT COALESCE(SUM(platform_fee),0) AS total FROM orders WHERE status IN ('delivered','completed')`,
      sql`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) FROM cook_payouts WHERE status = 'pending'`,
      sql`SELECT COUNT(*) FROM cooks WHERE verification_status = 'pending'`,
    ]);

    const ordersByStatus = {};
    for (const row of orders) ordersByStatus[row.status] = Number(row.count);

    res.json({
      total_users:            Number(users[0].count),
      total_active_cooks:     Number(cooks[0].count),
      orders_by_status:       ordersByStatus,
      total_orders:           Object.values(ordersByStatus).reduce((a, b) => a + b, 0),
      platform_revenue:       Number(revenue[0].total),
      pending_payout_amount:  Number(pendingPayouts[0].total),
      pending_payout_count:   Number(pendingPayouts[0].count),
      pending_verifications:  Number(pendingVerifications[0].count),
    });
  } catch (err) {
    console.error('admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/stats/chart', ...guard, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const rows = await sql`
      SELECT
        DATE(created_at) AS day,
        COUNT(*) AS orders,
        COALESCE(SUM(platform_fee), 0) AS revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '1 day' * ${Number(days)}
      GROUP BY day
      ORDER BY day
    `;
    res.json({ chart: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// ── Cooks ────────────────────────────────────────────────────

router.get('/cooks', ...guard, async (req, res) => {
  try {
    const { q, status, verified, limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT
        c.id, c.display_name, c.username, c.location, c.is_live, c.is_active,
        c.food_safety_verified, c.id_verified, c.verification_status,
        c.average_rating, c.total_orders, c.platform_follower_count,
        c.created_at,
        u.phone, u.email, u.full_name
      FROM cooks c
      JOIN users u ON u.id = c.user_id
      WHERE (
        ${q ? sql`(c.display_name ILIKE ${'%' + q + '%'} OR c.username ILIKE ${'%' + q + '%'} OR u.phone ILIKE ${'%' + q + '%'})` : sql`TRUE`}
      )
      AND (${status === 'active' ? sql`c.is_active = true` : status === 'suspended' ? sql`c.is_active = false` : sql`TRUE`})
      AND (${verified === 'true' ? sql`c.food_safety_verified = true` : verified === 'false' ? sql`c.food_safety_verified = false` : sql`TRUE`})
      ORDER BY c.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;

    const total = await sql`
      SELECT COUNT(*) FROM cooks c JOIN users u ON u.id = c.user_id
      WHERE (${q ? sql`(c.display_name ILIKE ${'%' + q + '%'} OR u.phone ILIKE ${'%' + q + '%'})` : sql`TRUE`})
    `;

    res.json({ cooks: rows, total: Number(total[0].count) });
  } catch (err) {
    console.error('admin cooks error:', err);
    res.status(500).json({ error: 'Failed to fetch cooks' });
  }
});

router.get('/cooks/:id', ...guard, async (req, res) => {
  try {
    const rows = await sql`
      SELECT c.*, u.phone, u.email, u.full_name, u.created_at AS joined_at
      FROM cooks c JOIN users u ON u.id = c.user_id
      WHERE c.id = ${req.params.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'Cook not found' });

    const [orders, payouts, recentOrders] = await Promise.all([
      sql`SELECT COUNT(*), COALESCE(SUM(cook_payout),0) AS total_earned FROM orders WHERE cook_id = ${req.params.id} AND status IN ('delivered','completed')`,
      sql`SELECT * FROM cook_payouts WHERE cook_id = ${req.params.id} ORDER BY created_at DESC LIMIT 5`,
      sql`SELECT id, status, total_amount, created_at FROM orders WHERE cook_id = ${req.params.id} ORDER BY created_at DESC LIMIT 10`,
    ]);

    res.json({
      cook: rows[0],
      stats: { total_orders: Number(orders[0].count), total_earned: Number(orders[0].total_earned) },
      recent_payouts: payouts,
      recent_orders: recentOrders,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cook' });
  }
});

router.patch('/cooks/:id/verify', ...guard, async (req, res) => {
  try {
    const { food_safety_verified, id_verified, verification_status } = req.body;
    const updates = {};
    if (food_safety_verified != null) updates.food_safety_verified = food_safety_verified;
    if (id_verified != null) updates.id_verified = id_verified;
    if (verification_status) updates.verification_status = verification_status;

    const rows = await sql`
      UPDATE cooks SET
        food_safety_verified = COALESCE(${updates.food_safety_verified ?? null}, food_safety_verified),
        id_verified          = COALESCE(${updates.id_verified ?? null}, id_verified),
        verification_status  = COALESCE(${updates.verification_status ?? null}, verification_status),
        updated_at           = NOW()
      WHERE id = ${req.params.id}
      RETURNING id, display_name, food_safety_verified, id_verified, verification_status
    `;
    res.json({ cook: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

router.patch('/cooks/:id/suspend', ...guard, async (req, res) => {
  try {
    const { suspended, reason } = req.body;
    const rows = await sql`
      UPDATE cooks SET is_active = ${!suspended}, updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING id, display_name, is_active
    `;
    if (reason) {
      await sql`
        INSERT INTO admin_actions (admin_user_id, target_type, target_id, action, reason)
        VALUES (${req.user.userId}, 'cook', ${req.params.id}, ${suspended ? 'suspend' : 'reinstate'}, ${reason})
        ON CONFLICT DO NOTHING
      `.catch(() => {}); // table may not exist yet, ignore
    }
    res.json({ cook: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cook status' });
  }
});

// ── Customers ────────────────────────────────────────────────

router.get('/customers', ...guard, async (req, res) => {
  try {
    const { q, limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT
        u.id, u.full_name, u.phone, u.email, u.is_active, u.created_at,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.total_amount),0) AS total_spent
      FROM users u
      LEFT JOIN orders o ON o.customer_id = u.id
      WHERE u.role = 'customer'
        AND (${q ? sql`(u.full_name ILIKE ${'%' + q + '%'} OR u.phone ILIKE ${'%' + q + '%'})` : sql`TRUE`})
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;
    const total = await sql`SELECT COUNT(*) FROM users WHERE role = 'customer'`;
    res.json({ customers: rows, total: Number(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.patch('/customers/:id/suspend', ...guard, async (req, res) => {
  try {
    const { suspended } = req.body;
    const rows = await sql`
      UPDATE users SET is_active = ${!suspended}, updated_at = NOW()
      WHERE id = ${req.params.id} AND role = 'customer'
      RETURNING id, full_name, phone, is_active
    `;
    res.json({ customer: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update customer status' });
  }
});

// ── Orders ───────────────────────────────────────────────────

router.get('/orders', ...guard, async (req, res) => {
  try {
    const { status, q, from, to, limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT
        o.*,
        c.display_name AS cook_name,
        u.full_name AS customer_name, u.phone AS customer_phone,
        mi.title AS item_title
      FROM orders o
      JOIN cooks c ON c.id = o.cook_id
      JOIN users u ON u.id = o.customer_id
      LEFT JOIN menu_items mi ON mi.id = o.menu_item_id
      WHERE
        (${status ? sql`o.status = ${status}` : sql`TRUE`})
        AND (${q ? sql`(c.display_name ILIKE ${'%' + q + '%'} OR u.full_name ILIKE ${'%' + q + '%'} OR o.id::text ILIKE ${'%' + q + '%'})` : sql`TRUE`})
        AND (${from ? sql`o.created_at >= ${from}::timestamptz` : sql`TRUE`})
        AND (${to ? sql`o.created_at <= ${to}::timestamptz` : sql`TRUE`})
      ORDER BY o.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;
    const total = await sql`SELECT COUNT(*) FROM orders WHERE (${status ? sql`status = ${status}` : sql`TRUE`})`;
    res.json({ orders: rows, total: Number(total[0].count) });
  } catch (err) {
    console.error('admin orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.patch('/orders/:id/status', ...guard, async (req, res) => {
  try {
    const { status, note } = req.body;
    const rows = await sql`
      UPDATE orders SET status = ${status}, updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING id, status, total_amount
    `;
    res.json({ order: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

router.post('/orders/:id/refund', ...guard, async (req, res) => {
  try {
    const { reason } = req.body;
    const rows = await sql`
      UPDATE orders SET status = 'refunded', updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING id, status, total_amount, customer_id, payment_tx_ref
    `;
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });

    await sql`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        ${rows[0].customer_id}, 'order_refunded',
        'Order refunded',
        'Your order has been refunded. Funds will be returned within 3-5 business days.',
        ${JSON.stringify({ order_id: rows[0].id })}
      )
    `.catch(() => {});

    res.json({ order: rows[0], message: 'Refund initiated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// ── Payouts ──────────────────────────────────────────────────

router.get('/payouts', ...guard, async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT cp.*, c.display_name AS cook_name, c.username AS cook_username, u.phone AS cook_phone
      FROM cook_payouts cp
      JOIN cooks c ON c.id = cp.cook_id
      JOIN users u ON u.id = c.user_id
      WHERE cp.status = ${status}
      ORDER BY cp.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;
    const total = await sql`SELECT COUNT(*), COALESCE(SUM(amount),0) AS total FROM cook_payouts WHERE status = ${status}`;
    res.json({ payouts: rows, total: Number(total[0].count), total_amount: Number(total[0].total) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

router.patch('/payouts/:id/process', ...guard, async (req, res) => {
  try {
    const { bank_reference } = req.body;
    const rows = await sql`
      UPDATE cook_payouts
      SET status = 'completed', processed_at = NOW(), bank_reference = ${bank_reference ?? null}
      WHERE id = ${req.params.id} AND status = 'pending'
      RETURNING *
    `;
    if (!rows.length) return res.status(404).json({ error: 'Payout not found or already processed' });

    await sql`
      INSERT INTO notifications (user_id, type, title, body, data)
      SELECT c.user_id, 'payout_processed', 'Payout sent',
        ${'Your payout of ' + rows[0].currency_code + ' ' + rows[0].amount + ' has been sent.'},
        ${JSON.stringify({ payout_id: rows[0].id })}
      FROM cooks c WHERE c.id = ${rows[0].cook_id}
    `.catch(() => {});

    res.json({ payout: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

// ── Reviews ──────────────────────────────────────────────────

router.get('/reviews', ...guard, async (req, res) => {
  try {
    const { flagged, q, limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT
        r.*,
        c.display_name AS cook_name,
        u.full_name AS customer_name
      FROM reviews r
      JOIN cooks c ON c.id = r.cook_id
      JOIN users u ON u.id = r.customer_id
      WHERE
        (${flagged === 'true' ? sql`r.is_flagged = true` : sql`TRUE`})
        AND (${q ? sql`(r.comment ILIKE ${'%' + q + '%'} OR u.full_name ILIKE ${'%' + q + '%'})` : sql`TRUE`})
      ORDER BY r.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `;
    res.json({ reviews: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.delete('/reviews/:id', ...guard, async (req, res) => {
  try {
    await sql`DELETE FROM reviews WHERE id = ${req.params.id}`;
    res.json({ message: 'Review removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove review' });
  }
});

router.patch('/reviews/:id/flag', ...guard, async (req, res) => {
  try {
    const { flagged } = req.body;
    const rows = await sql`
      UPDATE reviews SET is_flagged = ${flagged}, updated_at = NOW()
      WHERE id = ${req.params.id} RETURNING id, is_flagged
    `;
    res.json({ review: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to flag review' });
  }
});

// ── Platform config ──────────────────────────────────────────

router.get('/config', ...guard, async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM country_config ORDER BY country_code`;
    res.json({
      platform_fee_rate: Number(process.env.PLATFORM_FEE_RATE ?? 0.0375),
      country_configs: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// ── Dispute queue ────────────────────────────────────────────

router.get('/disputes', ...guard, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT d.*,
             u.full_name AS customer_name,
             cp.display_name AS cook_name,
             o.total_amount AS order_total
      FROM disputes d
      JOIN users u ON u.id = d.customer_id
      JOIN cook_profiles cp ON cp.id = d.cook_id
      JOIN orders o ON o.id = d.order_id
      WHERE (${status ? sql`d.status = ${status}` : sql`TRUE`})
      ORDER BY d.sla_deadline ASC
      LIMIT ${+limit} OFFSET ${+offset}
    `;
    const total = await sql`SELECT COUNT(*) FROM disputes WHERE (${status ? sql`status = ${status}` : sql`TRUE`})`;
    res.json({ disputes: rows, total: Number(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

router.patch('/disputes/:id/resolve', ...guard, async (req, res) => {
  try {
    const { resolution, resolution_type, refund_amount } = req.body;
    if (!resolution || !resolution_type) {
      return res.status(400).json({ error: 'resolution and resolution_type required' });
    }

    const disputes = await sql`SELECT * FROM disputes WHERE id = ${req.params.id}`;
    if (!disputes.length) return res.status(404).json({ error: 'Dispute not found' });
    const dispute = disputes[0];

    const [updated] = await sql`
      UPDATE disputes SET
        status = 'resolved', resolution = ${resolution},
        resolution_type = ${resolution_type},
        refund_amount = ${refund_amount ?? null},
        admin_id = ${req.user.id}, resolved_at = NOW(), updated_at = NOW()
      WHERE id = ${req.params.id} RETURNING *
    `;

    if (resolution_type === 'full_refund') {
      await sql`UPDATE escrow_holds SET status = 'refunded', released_at = NOW(), payout_blocked = false WHERE order_id = ${dispute.order_id}`;
      await sql`UPDATE orders SET status = 'refunded' WHERE id = ${dispute.order_id}`;
    } else if (resolution_type === 'no_refund') {
      await sql`UPDATE escrow_holds SET status = 'released', released_at = NOW(), payout_blocked = false WHERE order_id = ${dispute.order_id}`;
    } else if (resolution_type === 'partial_refund' && refund_amount) {
      await sql`UPDATE escrow_holds SET status = 'partial_refund', refund_amount = ${refund_amount}, released_at = NOW(), payout_blocked = false WHERE order_id = ${dispute.order_id}`;
    }

    res.json({ dispute: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

router.patch('/disputes/:id/escalate', ...guard, async (req, res) => {
  try {
    const [updated] = await sql`
      UPDATE disputes SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
      WHERE id = ${req.params.id} RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Dispute not found' });
    res.json({ dispute: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

// ── Verification queue ────────────────────────────────────────

router.get('/verifications', ...guard, async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT vs.*, cp.display_name AS cook_name, cp.avatar_url AS cook_avatar, u.phone
      FROM verification_submissions vs
      JOIN cook_profiles cp ON cp.id = vs.cook_id
      JOIN users u ON u.id = cp.user_id
      WHERE vs.status = ${status}
      ORDER BY vs.submitted_at ASC
      LIMIT ${+limit} OFFSET ${+offset}
    `;
    const total = await sql`SELECT COUNT(*) FROM verification_submissions WHERE status = ${status}`;
    res.json({ submissions: rows, total: Number(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

router.patch('/verifications/:id/approve', ...guard, async (req, res) => {
  try {
    const { review_notes, expires_at } = req.body;
    const [updated] = await sql`
      UPDATE verification_submissions SET
        status = 'approved',
        review_notes = ${review_notes ?? null},
        expires_at = ${expires_at ?? null}::date,
        reviewed_at = NOW(),
        reviewed_by = ${req.user.id}
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Submission not found' });
    res.json({ submission: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve' });
  }
});

router.patch('/verifications/:id/reject', ...guard, async (req, res) => {
  try {
    const { review_notes } = req.body;
    const [updated] = await sql`
      UPDATE verification_submissions SET
        status = 'rejected',
        review_notes = ${review_notes ?? null},
        reviewed_at = NOW(),
        reviewed_by = ${req.user.id}
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    if (!updated) return res.status(404).json({ error: 'Submission not found' });
    res.json({ submission: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// ── Content moderation queue ──────────────────────────────────

router.get('/moderation', ...guard, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const [flaggedReviews, reportedPosts] = await Promise.all([
      sql`
        SELECT r.id, r.comment, r.rating, r.report_reason, r.reported,
               r.created_at, 'review' AS entity_type,
               u.full_name AS reporter_name, cp.display_name AS cook_name
        FROM reviews r
        JOIN users u ON u.id = r.customer_id
        JOIN cook_profiles cp ON cp.id = r.cook_id
        WHERE r.reported = true
        ORDER BY r.created_at DESC LIMIT ${+limit} OFFSET ${+offset}
      `,
      sql`
        SELECT p.id, p.body, p.post_type, p.created_at, 'post' AS entity_type,
               cp.display_name AS cook_name
        FROM cook_diary_posts p
        JOIN cook_profiles cp ON cp.id = p.cook_id
        WHERE p.status = 'flagged'
        ORDER BY p.created_at DESC LIMIT ${+limit} OFFSET ${+offset}
      `.catch(() => []),
    ]);
    res.json({ flagged_reviews: flaggedReviews, reported_posts: reportedPosts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch moderation queue' });
  }
});

router.patch('/moderation/reviews/:id/dismiss', ...guard, async (req, res) => {
  try {
    await sql`UPDATE reviews SET reported = false, report_reason = null WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

router.delete('/moderation/reviews/:id', ...guard, async (req, res) => {
  try {
    await sql`DELETE FROM reviews WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ── Fraud dashboard ───────────────────────────────────────────

router.get('/fraud', ...guard, async (req, res) => {
  try {
    const [highDisputes, refundRate, suspiciousOrders] = await Promise.all([
      sql`
        SELECT cp.id, cp.display_name, COUNT(d.id) AS dispute_count
        FROM cook_profiles cp
        JOIN disputes d ON d.cook_id = cp.id
        WHERE d.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY cp.id, cp.display_name
        HAVING COUNT(d.id) >= 3
        ORDER BY dispute_count DESC LIMIT 20
      `,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'refunded') AS refunded,
          COUNT(*) AS total,
          ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'refunded') / NULLIF(COUNT(*),0), 2) AS rate
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `,
      sql`
        SELECT o.id, o.total_amount, o.status, o.created_at,
               u.full_name AS customer_name, cp.display_name AS cook_name
        FROM orders o
        JOIN users u ON u.id = o.customer_id
        JOIN cook_profiles cp ON cp.id = o.cook_id
        WHERE o.total_amount > 500000
          AND o.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY o.total_amount DESC LIMIT 10
      `,
    ]);

    res.json({
      high_dispute_cooks: highDisputes,
      refund_rate: refundRate[0],
      large_orders: suspiciousOrders,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fraud data' });
  }
});

// ── Platform settings ─────────────────────────────────────────

router.get('/settings', ...guard, async (req, res) => {
  res.json({
    platform_fee_rate:   Number(process.env.PLATFORM_FEE_RATE ?? 0.0375),
    min_order_amount:    Number(process.env.MIN_ORDER_AMOUNT ?? 1000),
    max_delivery_radius: Number(process.env.MAX_DELIVERY_RADIUS_KM ?? 20),
    dispute_sla_hours:   Number(process.env.DISPUTE_SLA_HOURS ?? 48),
    escrow_hold_days:    Number(process.env.ESCROW_HOLD_DAYS ?? 3),
    max_refund_days:     Number(process.env.MAX_REFUND_DAYS ?? 7),
  });
});

// ── Refund queue ──────────────────────────────────────────────

router.get('/refunds', ...guard, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const rows = await sql`
      SELECT d.id AS dispute_id, d.refund_amount, d.resolution_type,
             d.resolved_at, d.order_id,
             o.total_amount, o.payment_tx_ref,
             u.full_name AS customer_name, u.phone AS customer_phone
      FROM disputes d
      JOIN orders o ON o.id = d.order_id
      JOIN users u ON u.id = d.customer_id
      WHERE d.status = 'resolved'
        AND d.resolution_type IN ('full_refund','partial_refund')
      ORDER BY d.resolved_at DESC
      LIMIT ${+limit} OFFSET ${+offset}
    `;
    const total = await sql`
      SELECT COUNT(*) FROM disputes
      WHERE status = 'resolved' AND resolution_type IN ('full_refund','partial_refund')
    `;
    res.json({ refunds: rows, total: Number(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

module.exports = router;
