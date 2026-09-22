// Read-only audit of money granted without a payment, or against a payment
// that was already spent -- the holes migration 069 (payment_claims) closes.
// Run it against production once to see what, if anything, was exploited.
//
//   1. Gift cards. Until 069, POST /gifting/gift-cards minted a card of any
//      value with no payment at all, so no existing card was paid for. Lists
//      each card, and for redeemed ones the wallet it was credited to.
//   2. Creator subscriptions granted with no tx_ref (never verified).
//   3. Payment references used by more than one purchase (course, product,
//      subscription, top-up, card order), e.g. one charge enrolling two courses.
//   4. Wallet debits backing more order value than they debited, or reused.
//
// Works before and after migrations 068/069 (gift_cards.currency and tx_ref
// are read through to_jsonb), so it can be run before deploying.
//
// Usage: cd backend; node scripts/audit-payment-reuse.js
// Writes nothing. Point DATABASE_URL at the database to audit.
require('dotenv').config();
const { sql } = require('../supabase/db');

const section = (title, rows) => {
  console.log(`\n── ${title} (${rows.length}) ──`);
  if (rows.length) console.table(rows);
};

(async () => {
  console.log('Auditing', new URL(process.env.DATABASE_URL).hostname);

  section('Gift cards minted before payment was required', await sql`
    SELECT gc.code, gc.denomination, to_jsonb(gc)->>'currency' AS currency, gc.created_at::date AS created,
           buyer.phone AS minted_by, gc.is_redeemed,
           redeemer.phone AS redeemed_by
    FROM gift_cards gc
    LEFT JOIN users buyer    ON buyer.id = gc.purchased_by
    LEFT JOIN users redeemer ON redeemer.id = gc.redeemed_by
    WHERE to_jsonb(gc)->>'tx_ref' IS NULL
    ORDER BY gc.created_at
  `);

  section('Gift-card value credited to wallets, by currency', await sql`
    SELECT currency, count(*)::int AS cards, sum(amount_minor)::bigint AS credited_minor
    FROM wallet_transactions WHERE type = 'gift_redeem'
    GROUP BY currency
  `);

  section('Creator subscriptions granted with no payment reference', await sql`
    SELECT cs.id, u.phone AS subscriber, cs.amount_paid, cs.status, cs.started_at::date AS started
    FROM creator_subscriptions cs JOIN users u ON u.id = cs.subscriber_id
    WHERE cs.tx_ref IS NULL
    ORDER BY cs.started_at
  `);

  section('Payment references used by more than one purchase', await sql`
    WITH uses AS (
      SELECT tx_ref AS ref, 'course'       AS used_for, user_id       AS user_id FROM course_enrollments        WHERE tx_ref IS NOT NULL
      UNION ALL
      SELECT tx_ref, 'product',      user_id       FROM digital_product_purchases WHERE tx_ref IS NOT NULL
      UNION ALL
      SELECT tx_ref, 'subscription', subscriber_id FROM creator_subscriptions     WHERE tx_ref IS NOT NULL
      UNION ALL
      SELECT ref,    'wallet_topup', customer_id   FROM wallet_transactions       WHERE type = 'topup' AND ref IS NOT NULL
      UNION ALL
      SELECT DISTINCT flutterwave_tx_ref, 'card_order', customer_id FROM orders
      WHERE flutterwave_tx_ref IS NOT NULL AND payment_method NOT IN ('wallet', 'dev_mode')
        AND status NOT IN ('pending_payment', 'payment_failed', 'cancelled')
    )
    SELECT ref, string_agg(used_for, ', ' ORDER BY used_for) AS used_for, count(*)::int AS uses,
           count(DISTINCT user_id)::int AS users
    FROM uses GROUP BY ref HAVING count(*) > 1
    ORDER BY uses DESC
  `);

  section('Wallet debits backing more orders than they paid for', await sql`
    SELECT wt.ref, wt.currency, wt.amount_minor AS debited_minor,
           sum(o.total_amount_minor)::bigint AS orders_minor, count(o.id)::int AS orders
    FROM wallet_transactions wt
    JOIN orders o ON o.flutterwave_tx_ref = wt.ref AND o.payment_method = 'wallet'
    WHERE wt.type = 'debit'
    GROUP BY wt.ref, wt.currency, wt.amount_minor
    HAVING sum(o.total_amount_minor) > wt.amount_minor
    ORDER BY sum(o.total_amount_minor) - wt.amount_minor DESC
  `);

  await sql.end();
})().catch(async e => { console.error('audit error:', e.message); await sql.end(); process.exit(1); });
