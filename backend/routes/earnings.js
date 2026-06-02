const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { sql } = require('../supabase/db');
const https = require('https');

async function flutterwaveTransfer(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.flutterwave.com',
      path: '/v3/transfers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FW_SECRET_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ status: 'error' }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── GET /api/earnings ────────────────────────────────────────────────────────
// Cook's earnings summary + breakdown
router.get('/', authenticate, async (req, res) => {
  try {
    const cooks = await sql`SELECT id, currency_code FROM cook_profiles WHERE user_id = ${req.user.id}`;
    if (!cooks.length) return res.status(403).json({ error: 'Cook profile required' });
    const { id: cookId, currency_code } = cooks[0];

    const { period = 'week' } = req.query;

    let interval;
    if (period === 'today') interval = sql`CURRENT_DATE`;
    else if (period === 'week') interval = sql`date_trunc('week', CURRENT_DATE)`;
    else if (period === 'month') interval = sql`date_trunc('month', CURRENT_DATE)`;
    else interval = sql`date_trunc('year', CURRENT_DATE)`;

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
          AND created_at >= ${interval}
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
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
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

    // Phase 7: Require Paystack bank verification before payout
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

    // Calculate pending payout
    const pending = await sql`
      SELECT COALESCE(SUM(cook_payout), 0) AS amount
      FROM orders WHERE cook_id = ${cook.id} AND payout_status = 'pending' AND status = 'delivered'
    `;
    const amount = parseFloat(pending[0]?.amount ?? 0);

    if (amount < 1000) {
      return res.status(400).json({ error: 'Minimum payout amount is ₦1,000' });
    }

    const instant_fee = type === 'instant' ? Math.min(amount * 0.01, 500) : 0;

    const payout = await sql`
      INSERT INTO payouts (cook_id, amount, currency_code, type, instant_fee, status)
      VALUES (${cook.id}, ${amount}, ${cook.currency_code ?? 'NGN'}, ${type}, ${instant_fee}, 'pending')
      RETURNING *
    `;

    // Mark orders as payout queued
    await sql`
      UPDATE orders SET payout_status = 'queued', payout_batch_id = ${payout[0].id}
      WHERE cook_id = ${cook.id} AND payout_status = 'pending' AND status = 'delivered'
    `;

    // Attempt Flutterwave transfer if bank details are configured
    if (cook.bank_account_number && cook.bank_code) {
      try {
        const transferResult = await flutterwaveTransfer({
          account_bank: cook.bank_code,
          account_number: cook.bank_account_number,
          amount: amount - instant_fee,
          narration: `FOODSbyme payout - ${payout[0].id}`,
          currency: cook.currency_code ?? 'NGN',
          reference: `payout_${payout[0].id}`,
          beneficiary_name: cook.bank_account_name ?? undefined,
        });
        if (transferResult.status === 'success') {
          await sql`
            UPDATE payouts SET status = 'processing', fw_transfer_id = ${String(transferResult.data?.id ?? '')}
            WHERE id = ${payout[0].id}
          `;
        }
      } catch (e) {
        console.error('Flutterwave transfer error:', e);
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
