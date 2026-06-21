const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { sql }  = require('../supabase/db');
const { notifyAndPush } = require('../services/push');

// ── POST /api/fleet/operators ────────────────────────────────────────────────
// Register a new fleet operator (company or individual owning multiple vehicles).
router.post('/operators', authenticate, async (req, res) => {
  try {
    const {
      operator_type,         // 'company' | 'individual'
      business_name,
      contact_name,
      contact_phone,
      contact_email,
      vehicle_types,         // ['bike','bicycle']
      vehicle_count,
      service_areas,         // ['Ikeja','Victoria Island',...]
      id_document_url,
      vehicle_docs_url,
      insurance_url,
      bank_name,
      bank_account_number,
      bank_account_name,
      bank_code,
    } = req.body;

    if (!operator_type || !business_name || !contact_name || !contact_phone) {
      return res.status(400).json({ error: 'operator_type, business_name, contact_name and contact_phone are required' });
    }
    if (!['company', 'individual'].includes(operator_type)) {
      return res.status(400).json({ error: 'operator_type must be company or individual' });
    }
    if (!vehicle_types?.length) {
      return res.status(400).json({ error: 'At least one vehicle_type is required' });
    }

    // Prevent duplicate pending application
    const existing = await sql`
      SELECT id FROM fleet_operators
      WHERE user_id = ${req.user.id} AND status IN ('pending','approved')
      LIMIT 1
    `;
    if (existing.length) {
      return res.status(409).json({ error: 'You already have a fleet operator application', id: existing[0].id });
    }

    const [op] = await sql`
      INSERT INTO fleet_operators (
        user_id, operator_type, business_name, contact_name, contact_phone, contact_email,
        vehicle_types, vehicle_count, service_areas,
        id_document_url, vehicle_docs_url, insurance_url,
        bank_name, bank_account_number, bank_account_name, bank_code,
        status
      ) VALUES (
        ${req.user.id}, ${operator_type}, ${business_name}, ${contact_name}, ${contact_phone},
        ${contact_email ?? null},
        ${vehicle_types}::text[], ${vehicle_count ?? 1}, ${service_areas ?? []}::text[],
        ${id_document_url ?? null}, ${vehicle_docs_url ?? null}, ${insurance_url ?? null},
        ${bank_name ?? null}, ${bank_account_number ?? null}, ${bank_account_name ?? null}, ${bank_code ?? null},
        'pending'
      )
      RETURNING *
    `;

    res.status(201).json({ fleet_operator: op });
  } catch (err) {
    console.error('POST /fleet/operators:', err);
    res.status(500).json({ error: 'Failed to register fleet operator' });
  }
});

// ── GET /api/fleet/operators/me ──────────────────────────────────────────────
// Get the current user's fleet operator application.
router.get('/operators/me', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT fo.*,
        (SELECT COUNT(*)::int FROM rider_profiles rp WHERE rp.fleet_operator_id = fo.id) AS rider_count,
        (SELECT COUNT(*)::int FROM fleet_vehicles fv WHERE fv.fleet_operator_id = fo.id) AS vehicle_count_actual
      FROM fleet_operators fo
      WHERE fo.user_id = ${req.user.id}
      ORDER BY fo.created_at DESC
      LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'No fleet operator application found' });
    res.json({ fleet_operator: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fleet operator' });
  }
});

// ── POST /api/fleet/riders ───────────────────────────────────────────────────
// Register a solo rider or a rider under a fleet operator.
router.post('/riders', authenticate, async (req, res) => {
  try {
    const {
      fleet_operator_id,     // null = solo rider
      full_name,
      phone,
      vehicle_type,          // 'bike' | 'bicycle'
      vehicle_plate,
      government_id_url,
      vehicle_registration_url,
      service_areas,
      bank_name,
      bank_account_number,
      bank_account_name,
      bank_code,
    } = req.body;

    if (!full_name || !phone || !vehicle_type) {
      return res.status(400).json({ error: 'full_name, phone and vehicle_type are required' });
    }
    if (!['bike', 'bicycle'].includes(vehicle_type)) {
      return res.status(400).json({ error: 'vehicle_type must be bike or bicycle' });
    }

    // Prevent duplicate pending application
    const existing = await sql`
      SELECT id FROM rider_profiles
      WHERE user_id = ${req.user.id} AND status IN ('pending','approved')
      LIMIT 1
    `;
    if (existing.length) {
      return res.status(409).json({ error: 'You already have a rider application', id: existing[0].id });
    }

    // If fleet_operator_id provided, verify it's approved
    if (fleet_operator_id) {
      const op = await sql`SELECT id, status FROM fleet_operators WHERE id = ${fleet_operator_id} LIMIT 1`;
      if (!op.length) return res.status(404).json({ error: 'Fleet operator not found' });
      if (op[0].status !== 'approved') return res.status(400).json({ error: 'Fleet operator is not yet approved' });
    }

    const [rider] = await sql`
      INSERT INTO rider_profiles (
        user_id, fleet_operator_id,
        full_name, phone, vehicle_type, vehicle_plate,
        government_id_url, vehicle_registration_url,
        service_areas,
        bank_name, bank_account_number, bank_account_name, bank_code,
        status
      ) VALUES (
        ${req.user.id}, ${fleet_operator_id ?? null},
        ${full_name}, ${phone}, ${vehicle_type}, ${vehicle_plate ?? null},
        ${government_id_url ?? null}, ${vehicle_registration_url ?? null},
        ${service_areas ?? []}::text[],
        ${bank_name ?? null}, ${bank_account_number ?? null}, ${bank_account_name ?? null}, ${bank_code ?? null},
        'pending'
      )
      RETURNING *
    `;

    res.status(201).json({ rider });
  } catch (err) {
    console.error('POST /fleet/riders:', err);
    res.status(500).json({ error: 'Failed to register rider' });
  }
});

// ── GET /api/fleet/riders/me ─────────────────────────────────────────────────
router.get('/riders/me', authenticate, async (req, res) => {
  try {
    const rows = await sql`
      SELECT rp.*, fo.business_name AS fleet_name
      FROM rider_profiles rp
      LEFT JOIN fleet_operators fo ON fo.id = rp.fleet_operator_id
      WHERE rp.user_id = ${req.user.id}
      ORDER BY rp.created_at DESC
      LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'No rider profile found' });
    res.json({ rider: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rider profile' });
  }
});

// ── GET /api/fleet/operators (admin) ─────────────────────────────────────────
router.get('/operators', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { status, limit = 30, offset = 0 } = req.query;
    const rows = await sql`
      SELECT fo.*,
        u.full_name AS applicant_name, u.email AS applicant_email,
        (SELECT COUNT(*)::int FROM rider_profiles rp WHERE rp.fleet_operator_id = fo.id) AS rider_count
      FROM fleet_operators fo
      LEFT JOIN users u ON u.id = fo.user_id
      WHERE (${status ?? null}::text IS NULL OR fo.status = ${status ?? null})
      ORDER BY fo.created_at DESC
      LIMIT ${Math.min(parseInt(limit), 100)} OFFSET ${parseInt(offset)}
    `;
    res.json({ fleet_operators: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fleet operators' });
  }
});

// ── GET /api/fleet/riders (admin) ────────────────────────────────────────────
router.get('/riders', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { status, limit = 30, offset = 0 } = req.query;
    const rows = await sql`
      SELECT rp.*,
        u.full_name AS applicant_name, u.email AS applicant_email,
        fo.business_name AS fleet_name
      FROM rider_profiles rp
      LEFT JOIN users u ON u.id = rp.user_id
      LEFT JOIN fleet_operators fo ON fo.id = rp.fleet_operator_id
      WHERE (${status ?? null}::text IS NULL OR rp.status = ${status ?? null})
      ORDER BY rp.created_at DESC
      LIMIT ${Math.min(parseInt(limit), 100)} OFFSET ${parseInt(offset)}
    `;
    res.json({ riders: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch riders' });
  }
});

// ── PATCH /api/fleet/operators/:id/review (admin) ────────────────────────────
router.patch('/operators/:id/review', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { status, rejection_reason } = req.body;
    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved, rejected or suspended' });
    }

    const rows = await sql`SELECT * FROM fleet_operators WHERE id = ${req.params.id}`;
    if (!rows.length) return res.status(404).json({ error: 'Fleet operator not found' });

    const [updated] = await sql`
      UPDATE fleet_operators SET
        status           = ${status},
        rejection_reason = ${rejection_reason ?? null},
        approved_by      = ${status === 'approved' ? req.user.id : null},
        approved_at      = ${status === 'approved' ? new Date().toISOString() : null}::timestamptz,
        updated_at       = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // Notify the operator
    if (rows[0].user_id) {
      const title = status === 'approved' ? 'Fleet approved!' : status === 'rejected' ? 'Fleet application update' : 'Account suspended';
      const body  = status === 'approved'
        ? 'Your fleet has been approved. You can now receive delivery orders.'
        : status === 'rejected'
        ? `Your application was not approved${rejection_reason ? ': ' + rejection_reason : '.'}`
        : 'Your fleet account has been suspended. Contact support.';
      notifyAndPush(rows[0].user_id, `fleet_${status}`, title, body, { type: `fleet_${status}` }).catch(() => {});
    }

    res.json({ fleet_operator: updated });
  } catch (err) {
    console.error('PATCH /fleet/operators/:id/review:', err);
    res.status(500).json({ error: 'Failed to review fleet operator' });
  }
});

// ── PATCH /api/fleet/riders/:id/review (admin) ───────────────────────────────
router.patch('/riders/:id/review', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { status, rejection_reason } = req.body;
    if (!['approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved, rejected or suspended' });
    }

    const rows = await sql`SELECT * FROM rider_profiles WHERE id = ${req.params.id}`;
    if (!rows.length) return res.status(404).json({ error: 'Rider not found' });

    const [updated] = await sql`
      UPDATE rider_profiles SET
        status           = ${status},
        rejection_reason = ${rejection_reason ?? null},
        approved_by      = ${status === 'approved' ? req.user.id : null},
        approved_at      = ${status === 'approved' ? new Date().toISOString() : null}::timestamptz,
        updated_at       = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (rows[0].user_id) {
      const title = status === 'approved' ? 'Rider approved!' : 'Rider application update';
      const body  = status === 'approved'
        ? 'Your rider profile is approved. Download the FOODS Rider app to start receiving orders.'
        : `Your application was not approved${rejection_reason ? ': ' + rejection_reason : '.'}`;
      notifyAndPush(rows[0].user_id, `rider_${status}`, title, body, { type: `rider_${status}` }).catch(() => {});
    }

    res.json({ rider: updated });
  } catch (err) {
    console.error('PATCH /fleet/riders/:id/review:', err);
    res.status(500).json({ error: 'Failed to review rider' });
  }
});

// ── GET /api/fleet/orders/available — orders available for a rider to claim ──
router.get('/orders/available', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT * FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    const rows = await sql`
      SELECT o.*, cp.display_name AS cook_name, cp.location AS cook_address
      FROM orders o
      LEFT JOIN cook_profiles cp ON cp.id = o.cook_id
      WHERE o.status = 'ready'
        AND o.logistics_type = 'foods_network'
        AND o.assigned_rider_id IS NULL
        AND o.delivery_address IS NOT NULL
        AND o.delivery_address != 'PICKUP'
      ORDER BY o.updated_at DESC
      LIMIT 20
    `;
    res.json({ orders: rows });
  } catch (err) {
    console.error('GET /fleet/orders/available:', err);
    res.status(500).json({ error: 'Failed to fetch available orders' });
  }
});

// ── GET /api/fleet/orders/mine — orders assigned to this rider ───────────────
router.get('/orders/mine', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT id FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    const rows = await sql`
      SELECT o.*, cp.display_name AS cook_name, cp.location AS cook_address
      FROM orders o
      LEFT JOIN cook_profiles cp ON cp.id = o.cook_id
      WHERE o.assigned_rider_id = ${rider[0].id}
        AND o.status IN ('ready','out_for_delivery','in_transit')
      ORDER BY o.updated_at DESC
    `;
    res.json({ orders: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch assigned orders' });
  }
});

// ── POST /api/fleet/orders/:id/claim — rider claims an available order ───────
router.post('/orders/:id/claim', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT id FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    const order = await sql`SELECT * FROM orders WHERE id = ${req.params.id} LIMIT 1`;
    if (!order.length) return res.status(404).json({ error: 'Order not found' });
    if (order[0].assigned_rider_id) return res.status(409).json({ error: 'Order already claimed by another rider' });
    if (order[0].status !== 'ready') return res.status(400).json({ error: 'Order is not in ready status' });

    const [updated] = await sql`
      UPDATE orders SET assigned_rider_id = ${rider[0].id}, updated_at = NOW()
      WHERE id = ${req.params.id} AND assigned_rider_id IS NULL
      RETURNING *
    `;
    if (!updated) return res.status(409).json({ error: 'Order was just claimed by someone else' });

    res.json({ order: updated });
  } catch (err) {
    console.error('POST /fleet/orders/:id/claim:', err);
    res.status(500).json({ error: 'Failed to claim order' });
  }
});

// ── POST /api/fleet/orders/:id/verify-collection-otp ─────────────────────────
// Rider enters the OTP the cook shows them to confirm pickup.
router.post('/orders/:id/verify-collection-otp', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT id FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP is required' });

    const [order] = await sql`SELECT * FROM orders WHERE id = ${req.params.id} AND assigned_rider_id = ${rider[0].id} LIMIT 1`;
    if (!order) return res.status(404).json({ error: 'Order not found or not assigned to you' });
    if (!order.otp_enabled || !order.collection_otp) return res.status(400).json({ error: 'This order does not require a collection OTP' });
    if (order.collection_otp_verified_at) return res.status(400).json({ error: 'Collection OTP already verified' });
    if (otp !== order.collection_otp) return res.status(400).json({ error: 'Incorrect OTP. Please check with the cook.' });

    const [updated] = await sql`
      UPDATE orders SET
        collection_otp_verified_at = NOW(),
        status = 'out_for_delivery',
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ order: updated });
  } catch (err) {
    console.error('POST /fleet/orders/:id/verify-collection-otp:', err);
    res.status(500).json({ error: 'Failed to verify collection OTP' });
  }
});

// ── POST /api/fleet/orders/:id/verify-delivery-otp ──────────────────────────
// Rider enters the OTP the customer shows them to confirm delivery.
router.post('/orders/:id/verify-delivery-otp', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT id FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP is required' });

    const [order] = await sql`SELECT * FROM orders WHERE id = ${req.params.id} AND assigned_rider_id = ${rider[0].id} LIMIT 1`;
    if (!order) return res.status(404).json({ error: 'Order not found or not assigned to you' });
    if (!order.otp_enabled || !order.delivery_otp) return res.status(400).json({ error: 'This order does not require a delivery OTP' });
    if (order.delivery_otp_verified_at) return res.status(400).json({ error: 'Delivery OTP already verified' });
    if (otp !== order.delivery_otp) return res.status(400).json({ error: 'Incorrect OTP. Ask the customer to open the tracking screen.' });

    const now = new Date().toISOString();
    const { proof_photo_url } = req.body;
    const [updated] = await sql`
      UPDATE orders SET
        delivery_otp_verified_at = ${now}::timestamptz,
        status = 'delivered',
        delivered_at = ${now}::timestamptz,
        proof_photo_url = COALESCE(${proof_photo_url ?? null}, proof_photo_url),
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    // Update rider delivery count
    sql`UPDATE rider_profiles SET total_deliveries = total_deliveries + 1 WHERE id = ${rider[0].id}`.catch(() => {});

    res.json({ order: updated });
  } catch (err) {
    console.error('POST /fleet/orders/:id/verify-delivery-otp:', err);
    res.status(500).json({ error: 'Failed to verify delivery OTP' });
  }
});

// ── POST /api/fleet/orders/:id/skip-collection-otp ──────────────────────────
// Rider advances to out_for_delivery when OTP is not required.
router.post('/orders/:id/skip-collection-otp', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT id FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    const [order] = await sql`SELECT * FROM orders WHERE id = ${req.params.id} AND assigned_rider_id = ${rider[0].id} LIMIT 1`;
    if (!order) return res.status(404).json({ error: 'Order not found or not assigned to you' });
    if (order.otp_enabled) return res.status(400).json({ error: 'Collection OTP is required for this order' });

    const [updated] = await sql`
      UPDATE orders SET status = 'out_for_delivery', updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ order: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to advance order' });
  }
});

// ── POST /api/fleet/orders/:id/skip-delivery-otp ────────────────────────────
// Rider marks delivered when OTP is not required.
router.post('/orders/:id/skip-delivery-otp', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT id FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    const [order] = await sql`SELECT * FROM orders WHERE id = ${req.params.id} AND assigned_rider_id = ${rider[0].id} LIMIT 1`;
    if (!order) return res.status(404).json({ error: 'Order not found or not assigned to you' });
    if (order.otp_enabled) return res.status(400).json({ error: 'Delivery OTP is required for this order' });

    const now = new Date().toISOString();
    const { proof_photo_url } = req.body;
    const [updated] = await sql`
      UPDATE orders SET
        status = 'delivered',
        delivered_at = ${now}::timestamptz,
        proof_photo_url = COALESCE(${proof_photo_url ?? null}, proof_photo_url),
        updated_at = NOW()
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    sql`UPDATE rider_profiles SET total_deliveries = total_deliveries + 1 WHERE id = ${rider[0].id}`.catch(() => {});
    res.json({ order: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark delivered' });
  }
});

// ── GET /api/fleet/operators/me/earnings — fleet operator revenue dashboard ───
router.get('/operators/me/earnings', authenticate, async (req, res) => {
  try {
    const ops = await sql`SELECT * FROM fleet_operators WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!ops.length) return res.status(403).json({ error: 'Approved fleet operator account required' });
    const op = ops[0];

    const [aggregate, perRider, daily] = await Promise.all([
      // Total across all riders this week + all-time
      sql`
        SELECT
          COUNT(DISTINCT o.id)::int                                              AS total_deliveries,
          COALESCE(SUM(o.delivery_fee), 0)                                       AS total_gross,
          COUNT(DISTINCT o.id) FILTER (WHERE o.delivered_at >= NOW() - INTERVAL '7 days')::int AS week_deliveries,
          COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.delivered_at >= NOW() - INTERVAL '7 days'), 0) AS week_gross,
          COUNT(DISTINCT rp.id)::int                                             AS rider_count,
          COUNT(DISTINCT rp.id) FILTER (WHERE rp.is_available = true)::int      AS active_riders
        FROM rider_profiles rp
        LEFT JOIN orders o ON o.assigned_rider_id = rp.id AND o.status IN ('delivered','completed')
        WHERE rp.fleet_operator_id = ${op.id}
      `,
      // Per-rider breakdown
      sql`
        SELECT
          rp.id,
          u.full_name,
          u.phone,
          rp.vehicle_type,
          rp.status,
          rp.is_available,
          rp.total_deliveries,
          COALESCE(SUM(o.delivery_fee), 0)                                                AS all_time_gross,
          COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.delivered_at >= NOW() - INTERVAL '7 days'), 0) AS week_gross,
          COUNT(o.id) FILTER (WHERE o.delivered_at >= NOW() - INTERVAL '7 days')::int    AS week_deliveries
        FROM rider_profiles rp
        JOIN users u ON u.id = rp.user_id
        LEFT JOIN orders o ON o.assigned_rider_id = rp.id AND o.status IN ('delivered','completed')
        WHERE rp.fleet_operator_id = ${op.id}
        GROUP BY rp.id, u.full_name, u.phone, rp.vehicle_type, rp.status, rp.is_available, rp.total_deliveries
        ORDER BY all_time_gross DESC
      `,
      // 30-day daily aggregate
      sql`
        SELECT
          DATE_TRUNC('day', o.delivered_at)::date AS day,
          COUNT(o.id)::int                        AS deliveries,
          COALESCE(SUM(o.delivery_fee), 0)        AS gross
        FROM orders o
        JOIN rider_profiles rp ON rp.id = o.assigned_rider_id AND rp.fleet_operator_id = ${op.id}
        WHERE o.status IN ('delivered','completed')
          AND o.delivered_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    res.json({
      operator: { id: op.id, business_name: op.business_name, status: op.status },
      aggregate: aggregate[0],
      per_rider: perRider,
      daily_breakdown: daily,
    });
  } catch (err) {
    console.error('GET /fleet/operators/me/earnings:', err);
    res.status(500).json({ error: 'Failed to fetch operator earnings' });
  }
});

// ── GET /api/fleet/earnings — rider earnings summary ─────────────────────────
router.get('/earnings', authenticate, async (req, res) => {
  try {
    const rider = await sql`SELECT * FROM rider_profiles WHERE user_id = ${req.user.id} AND status = 'approved' LIMIT 1`;
    if (!rider.length) return res.status(403).json({ error: 'Approved rider account required' });

    // Weekly deliveries (last 7 days)
    const thisWeek = await sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(o.delivery_fee), 0) AS gross
      FROM orders o
      WHERE o.assigned_rider_id = ${rider[0].id}
        AND o.status IN ('delivered','completed')
        AND o.delivered_at >= NOW() - INTERVAL '7 days'
    `;
    // All-time
    const allTime = await sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(o.delivery_fee), 0) AS gross
      FROM orders o
      WHERE o.assigned_rider_id = ${rider[0].id}
        AND o.status IN ('delivered','completed')
    `;
    // Last 30 days breakdown by day
    const daily = await sql`
      SELECT DATE_TRUNC('day', o.delivered_at)::date AS day,
             COUNT(*)::int AS deliveries,
             COALESCE(SUM(o.delivery_fee), 0) AS gross
      FROM orders o
      WHERE o.assigned_rider_id = ${rider[0].id}
        AND o.status IN ('delivered','completed')
        AND o.delivered_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `;

    res.json({
      rider: {
        id: rider[0].id,
        full_name: rider[0].full_name,
        total_deliveries: rider[0].total_deliveries,
        status: rider[0].status,
      },
      this_week: thisWeek[0],
      all_time: allTime[0],
      daily_breakdown: daily,
    });
  } catch (err) {
    console.error('GET /fleet/earnings:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// ── PATCH /api/fleet/riders/me/availability ─────────────────────────────────
router.patch('/riders/me/availability', authenticate, async (req, res) => {
  try {
    const { is_available } = req.body;
    const [updated] = await sql`
      UPDATE rider_profiles SET is_available = ${!!is_available}, updated_at = NOW()
      WHERE user_id = ${req.user.id} AND status = 'approved'
      RETURNING id, is_available
    `;
    if (!updated) return res.status(404).json({ error: 'Approved rider profile not found' });
    res.json({ is_available: updated.is_available });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// ── POST /api/fleet/orders/:id/location — rider broadcasts GPS position ───────
router.post('/orders/:id/location', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, heading, speed } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'latitude and longitude required' });

    // Verify rider owns this order
    const orders = await sql`
      SELECT o.id FROM orders o
      JOIN rider_profiles rp ON rp.id = o.assigned_rider_id
      WHERE o.id = ${req.params.id} AND rp.user_id = ${req.user.id}
        AND o.status IN ('rider_assigned','picked_up','in_transit','out_for_delivery')
    `;
    if (!orders.length) return res.status(403).json({ error: 'Not your active order' });

    await sql`
      INSERT INTO rider_locations (order_id, rider_user_id, latitude, longitude, heading, speed)
      VALUES (${req.params.id}, ${req.user.id}, ${latitude}, ${longitude},
              ${heading ?? null}, ${speed ?? null})
      ON CONFLICT (order_id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        heading = EXCLUDED.heading,
        speed = EXCLUDED.speed,
        updated_at = NOW()
    `.catch(async () => {
      // Table may not exist yet — create and retry
      await sql`
        CREATE TABLE IF NOT EXISTS rider_locations (
          order_id      uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
          rider_user_id uuid,
          latitude      numeric(10,7) NOT NULL,
          longitude     numeric(10,7) NOT NULL,
          heading       numeric(5,2),
          speed         numeric(6,2),
          updated_at    timestamptz NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        INSERT INTO rider_locations (order_id, rider_user_id, latitude, longitude, heading, speed)
        VALUES (${req.params.id}, ${req.user.id}, ${latitude}, ${longitude},
                ${heading ?? null}, ${speed ?? null})
        ON CONFLICT (order_id) DO UPDATE SET
          latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
          heading = EXCLUDED.heading, speed = EXCLUDED.speed, updated_at = NOW()
      `;
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /fleet/orders/:id/location:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// ── GET /api/fleet/orders/:id/location — customer polls rider GPS ─────────────
router.get('/orders/:id/location', authenticate, async (req, res) => {
  try {
    // Verify requester is the customer or the rider
    const orders = await sql`
      SELECT o.customer_id, o.cook_id, o.status, o.assigned_rider_id
      FROM orders o WHERE o.id = ${req.params.id}
    `;
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    const isCustomer = order.customer_id === req.user.id;
    const cookRows = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    const isCook = cookRows.some(c => c.id === order.cook_id);
    if (!isCustomer && !isCook && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const loc = await sql`SELECT * FROM rider_locations WHERE order_id = ${req.params.id}`.catch(() => []);
    if (!loc.length) return res.json({ location: null });

    res.json({ location: loc[0], order_status: order.status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

module.exports = router;
