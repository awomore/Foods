// READ-ONLY audit: were any tips recorded (and paid out) without a payment?
//
// Before 2026-10-17, POST /api/tips and POST /api/orders/:id/tip saved any
// amount with no payment, and cook payouts include pending tips. This lists
// what exists so a person can judge whether any were invented. It writes nothing.
//
//   DATABASE_URL=<Railway Postgres DATABASE_PUBLIC_URL> node scripts/audit-tips.js
require('dotenv').config();
const { sql } = require('../supabase/db');

(async () => {
  const byStatus = await sql`
    SELECT payout_status, currency_code, COUNT(*)::int AS tips, COALESCE(SUM(amount), 0)::text AS total,
           MIN(created_at) AS first, MAX(created_at) AS last
    FROM tips GROUP BY 1, 2 ORDER BY 1, 2
  `;
  console.log('\nTips by payout status:');
  console.table(byStatus);

  // A tip from the cook's own account, or one larger than its order, is the
  // pattern an invented tip would leave.
  const suspicious = await sql`
    SELECT t.id, t.amount::text, t.currency_code, t.payout_status, t.created_at,
           t.flutterwave_tx_ref IS NOT NULL AS has_payment_ref,
           (cp.user_id = t.customer_id) AS self_tip,
           o.total_amount::text AS order_total
    FROM tips t
    JOIN cook_profiles cp ON cp.id = t.cook_id
    LEFT JOIN orders o ON o.id = t.order_id
    WHERE cp.user_id = t.customer_id
       OR t.order_id IS NULL
       OR (o.total_amount IS NOT NULL AND t.amount > o.total_amount)
       OR t.flutterwave_tx_ref IS NULL
    ORDER BY t.amount DESC
    LIMIT 50
  `;
  console.log(`\nTips without a payment reference, self-tips, or larger than their order (${suspicious.length} shown, max 50):`);
  console.table(suspicious);

  const paidOut = await sql`
    SELECT p.id AS payout_id, p.status, p.amount::text, p.currency_code, p.created_at,
           COUNT(t.id)::int AS tips_in_payout, COALESCE(SUM(t.amount), 0)::text AS tip_total
    FROM payouts p JOIN tips t ON t.payout_batch_id = p.id::text
    GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50
  `;
  console.log('\nPayouts that included tips:');
  console.table(paidOut);

  await sql.end();
})().catch(err => { console.error('audit failed:', err.message); process.exit(1); });
