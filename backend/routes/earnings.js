const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const { notifyAndPush } = require('../services/push');
const { orchestrator } = require('../payments/orchestrator');

// ── GET /api/earnings ────────────────────────────────────────────────────────
// Cook's earnings summary + breakdown
router.get('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id, currency_code FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const { id: cookId, currency_code } = cooks[0];

    const { period = 'week' } = req.query;

    // date_trunc('day', CURRENT_DATE) === CURRENT_DATE, so map 'today' -> 'day'.
    // Pass the unit as a text param rather than nesting a sql`` fragment —
    // @neondatabase/serverless serializes nested fragments used in a value
    // position as a JSON parameter, producing an invalid-timestamp 500.
    const truncUnit =
      period === 'today' ? 'day' :
      period === 'month' ? 'month' :
      period === 'year'  ? 'year'  : 'week';

    const [summary, daily, pending, preorders] = await Promise.all([
      // Period summary
      sql`
        SELECT
          COUNT(*) AS total_orders,
          COALESCE(SUM(cook_payout), 0) AS total_earned,
          COALESCE(SUM(platform_fee), 0) AS platform_fees,
          COALESCE(SUM(delivery_fee), 0) AS delivery_fees,
          ROUND(AVG(unit_price)::numeric, 2) AS avg_order_value
        FROM orders
        WHERE cook_id = ${cookId}
          AND status IN ('delivered', 'completed', 'in_transit', 'ready', 'accepted', 'preparing')
          AND created_at >= date_trunc(${truncUnit}, CURRENT_DATE)
      `,
      // Daily breakdown (last 7 days)
      sql`
        SELECT
          DATE(created_at) AS day,
          COUNT(*) AS orders,
          COALESCE(SUM(cook_payout), 0) AS earned
        FROM orders
        WHERE cook_id = ${cookId}
          AND status IN ('delivered', 'completed', 'in_transit', 'ready', 'accepted', 'preparing')
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `,
      // Pending payouts
      sql`
        SELECT COALESCE(SUM(cook_payout), 0) AS pending_amount
        FROM orders
        WHERE cook_id = ${cookId}
          AND payout_status = 'pending'
          AND status = 'delivered'
      `,
      // Upcoming pre-orders value
      sql`
        SELECT COALESCE(SUM(cook_payout), 0) AS upcoming_amount, COUNT(*) AS upcoming_count
        FROM orders
        WHERE cook_id = ${cookId}
          AND status IN ('paid', 'confirmed')
          AND order_type = 'preorder'
      `,
    ]);

    // Lifetime
    const lifetime = await sql`
      SELECT COALESCE(SUM(cook_payout), 0) AS total FROM orders
      WHERE cook_id = ${cookId} AND status = 'delivered'
    `;

    // Payout history
    const payouts = await sql`
      SELECT * FROM payouts WHERE cook_id = ${cookId}
      ORDER BY created_at DESC LIMIT 10
    `;

    // Savings balance
    const savings = await sql`
      SELECT * FROM cook_savings WHERE cook_id = ${cookId}
    `;

    res.json({
      period,
      currency_code,
      summary: summary[0],
      daily_breakdown: daily,
      pending_payout: parseFloat(pending[0]?.pending_amount ?? 0),
      upcoming_preorders: {
        amount: parseFloat(preorders[0]?.upcoming_amount ?? 0),
        count: parseInt(preorders[0]?.upcoming_count ?? 0),
      },
      lifetime_earned: parseFloat(lifetime[0]?.total ?? 0),
      recent_payouts: payouts,
      savings: savings[0] ?? null,
    });
  } catch (err) {
    console.error('GET /earnings:', err);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// ── GET /api/earnings/orders ─────────────────────────────────────────────────
// Recent delivered orders for the cook
router.get('/orders', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });

    const { limit = 20, offset = 0 } = req.query;

    const orders = await sql`
      SELECT o.id, o.status, o.cook_payout, o.currency_code, o.created_at,
             o.payout_status, mi.title AS item_title,
             u.full_name AS customer_name
      FROM orders o
      JOIN menu_items mi ON mi.id = o.menu_item_id
      JOIN users u ON u.id = o.customer_id
      WHERE o.cook_id = ${cooks[0].id}
        AND o.status IN ('delivered', 'completed', 'in_transit', 'ready', 'accepted', 'preparing', 'payment_confirmed')
      ORDER BY o.created_at DESC
      LIMIT ${Math.min(parseInt(limit), 100)} OFFSET ${parseInt(offset)}
    `;

    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch earnings orders' });
  }
});

// ── POST /api/earnings/payout ───────────────────────────────────────────────
router.post('/payout', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id, bank_account_number, bank_account_name, bank_name, bank_code, currency_code, bank_verified, payout_blocked, payout_blocked_reason FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const cook = cooks[0];

    if (!cook.bank_account_number) {
      return res.status(400).json({ error: 'No bank account configured' });
    }

    // Phase 7: Require Flutterwave bank verification before payout
    if (!cook.bank_verified) {
      return res.status(403).json({
        error: 'Bank account not verified. Please verify your account number via Settings before requesting a payout.',
        code: 'BANK_NOT_VERIFIED',
      });
    }

    // Phase 7: Block payout if cook profile is payout_blocked
    if (cook.payout_blocked) {
      return res.status(403).json({
        error: `Payouts blocked: ${cook.payout_blocked_reason ?? 'Unresolved compliance issue. Contact support.'}`,
        code: 'PAYOUT_BLOCKED',
      });
    }

    // Phase 7: Block payout if there are open disputes
    const openDisputes = await sql`
      SELECT COUNT(*) AS count FROM disputes d
      JOIN orders o ON o.id = d.order_id
      WHERE o.cook_id = ${cook.id}
        AND d.status NOT IN ('resolved','closed')
    `;
    if (parseInt(openDisputes[0].count) > 0) {
      return res.status(403).json({
        error: `You have ${openDisputes[0].count} unresolved dispute(s). Payouts are held until disputes are settled.`,
        code: 'OPEN_DISPUTES',
        dispute_count: parseInt(openDisputes[0].count),
      });
    }

    const { type = 'standard' } = req.body;

    // Wrap the payout creation in a transaction with an advisory lock to prevent
    // concurrent payout requests from the same cook resulting in double-transfer.
    let payout;
    let amount;
    let instant_fee;
    try {
      await sql.begin(async sql => {
        // Serialise payout requests per cook — only one can hold this lock at a time
        await sql`SELECT pg_advisory_xact_lock(('x' || md5(${cook.id}))::bit(64)::bigint)`;

        // Reject if a payout is already in progress (pending or processing)
        const inFlight = await sql`
          SELECT id FROM payouts WHERE cook_id = ${cook.id} AND status IN ('pending', 'processing')
        `;
        if (inFlight.length) {
          const err = new Error('A payout is already in progress. Please wait for it to complete before requesting another.');
          err.code = 'PAYOUT_IN_FLIGHT';
          throw err;
        }

        // Calculate pending payout (orders + tips)
        const [pendingOrders, pendingTips] = await Promise.all([
          sql`SELECT COALESCE(SUM(cook_payout), 0) AS amount
              FROM orders WHERE cook_id = ${cook.id} AND payout_status = 'pending' AND status = 'delivered'`,
          sql`SELECT COALESCE(SUM(amount), 0) AS amount
              FROM tips WHERE cook_id = ${cook.id} AND payout_status = 'pending'`,
        ]);
        const ordersAmount = parseFloat(pendingOrders[0]?.amount ?? 0);
        const tipsAmount   = parseFloat(pendingTips[0]?.amount ?? 0);
        amount = ordersAmount + tipsAmount;
        instant_fee = type === 'instant' ? Math.min(amount * 0.01, 500) : 0;

        if (amount < 1000) {
          const err = new Error('Minimum payout amount is ₦1,000');
          err.code = 'MIN_PAYOUT';
          throw err;
        }

        const payoutRows = await sql`
          INSERT INTO payouts (cook_id, amount, currency_code, type, instant_fee, status)
          VALUES (${cook.id}, ${amount}, ${cook.currency_code ?? 'NGN'}, ${type}, ${instant_fee}, 'pending')
          RETURNING *
        `;
        payout = payoutRows;

        // Mark orders and tips as payout queued atomically within the transaction
        await Promise.all([
          sql`UPDATE orders SET payout_status = 'queued', payout_batch_id = ${payoutRows[0].id}
              WHERE cook_id = ${cook.id} AND payout_status = 'pending' AND status = 'delivered'`,
          sql`UPDATE tips SET payout_status = 'queued', payout_batch_id = ${String(payoutRows[0].id)}
              WHERE cook_id = ${cook.id} AND payout_status = 'pending'`,
        ]);
      });
    } catch (txErr) {
      if (txErr.code === 'PAYOUT_IN_FLIGHT') {
        return res.status(409).json({ error: txErr.message, code: 'PAYOUT_IN_FLIGHT' });
      }
      if (txErr.code === 'MIN_PAYOUT') {
        return res.status(400).json({ error: txErr.message });
      }
      throw txErr;
    }

    // Attempt payout transfer through the orchestrator if bank details are configured
    if (cook.bank_account_number && cook.bank_code) {
      try {
        const transferResult = await orchestrator.payout(
          {
            bankCode: cook.bank_code,
            accountNumber: cook.bank_account_number,
            accountName: cook.bank_account_name ?? undefined,
          },
          {
            amount: amount - instant_fee,
            currency: cook.currency_code ?? 'NGN',
            reference: `payout_${payout[0].id}`,
            narration: `FOODSbyme payout - ${payout[0].id}`,
          },
        );
        if (transferResult.accepted) {
          await sql`
            UPDATE payouts SET status = 'processing', fw_transfer_id = ${transferResult.providerTransferId ?? ''}
            WHERE id = ${payout[0].id}
          `;
        } else {
          throw new Error(transferResult.failureReason ?? 'Transfer rejected by payment provider');
        }
      } catch (e) {
        console.error('Flutterwave transfer error:', e);
        // Mark payout failed and restore orders to pending so cook can retry
        await sql`
          UPDATE payouts
          SET status = 'failed', failure_reason = ${e.message ?? 'Transfer error'}
          WHERE id = ${payout[0].id}
        `.catch(() => {});
        await sql`
          UPDATE orders
          SET payout_status = 'pending', payout_batch_id = NULL
          WHERE payout_batch_id = ${payout[0].id}
        `.catch(() => {});
        await sql`
          UPDATE tips
          SET payout_status = 'pending', payout_batch_id = NULL
          WHERE payout_batch_id = ${String(payout[0].id)}
        `.catch(() => {});
        notifyAndPush(
          req.user.id,
          'payout_failed',
          'Payout failed',
          'We could not process your payout. Please try again or contact support.',
          { payout_id: payout[0].id, type: 'payout_failed' }
        ).catch(() => {});
      }
    }

    const updatedPayout = await sql`SELECT * FROM payouts WHERE id = ${payout[0].id}`;
    res.status(201).json({ payout: updatedPayout[0] });
  } catch (err) {
    console.error('POST /earnings/payout:', err);
    res.status(500).json({ error: 'Failed to request payout' });
  }
});

module.exports = router;
