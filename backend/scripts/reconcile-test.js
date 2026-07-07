// Integration test for the pending_payment reconciliation (services/reconcilePayments.js).
// Seeds three stuck orders and drives all three branches with a stubbed gateway
// verifier — paid → recover + ledger capture, unpaid → cancel, verify-error →
// defer (stays pending). Uses the app's `postgres` driver directly (no HTTP, no
// gateway), so it's deterministic and offline.
// Usage: cd backend; node scripts/reconcile-test.js
require('dotenv').config();
const { sql } = require('../supabase/db');
const { reconcilePendingPayments } = require('../services/reconcilePayments');

const CUSTOMER_PHONE = '+2349900000801';
const COOK_PHONE     = '+2349900000802';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

async function ensureUser(phone, name, role) {
  const ex = await sql`SELECT id FROM users WHERE phone = ${phone}`;
  if (ex.length) return ex[0].id;
  const [u] = await sql`INSERT INTO users (full_name, phone, role, is_active) VALUES (${name}, ${phone}, ${role}, true) RETURNING id`;
  return u.id;
}

async function seedOrder(customer, cook, menuItemId, txRef) {
  // 20 minutes old so it's past the 15-min window. Minor amounts mirror a
  // ₦2500 item (fee 3.75%): total 259375, cook_payout 240625, delivery 0.
  const [o] = await sql`
    INSERT INTO orders (
      customer_id, cook_id, menu_item_id, currency_code, order_type,
      status, quantity, unit_price, subtotal, delivery_fee, platform_fee,
      total_amount, cook_payout,
      subtotal_minor, delivery_fee_minor, platform_fee_minor, total_amount_minor, cook_payout_minor,
      payment_method, flutterwave_tx_ref, created_at
    ) VALUES (
      ${customer}, ${cook}, ${menuItemId}, 'NGN', 'preorder',
      'pending_payment', 1, 2500, 2500, 0, 93.75,
      2593.75, 2406.25,
      250000, 0, 9375, 259375, 240625,
      'card', ${txRef}, NOW() - INTERVAL '20 minutes'
    ) RETURNING id`;
  return o.id;
}

(async () => {
  const customer = await ensureUser(CUSTOMER_PHONE, 'E2E Test Customer', 'customer');
  const cook     = await ensureUser(COOK_PHONE, 'E2E Test Cook', 'cook');
  const [cp] = await sql`SELECT id FROM cook_profiles WHERE user_id = ${cook}`;
  const cookProfileId = cp?.id;
  if (!cookProfileId) { console.error('no cook profile — run e2e-harness first'); process.exit(1); }

  // A dedicated menu item to satisfy orders.menu_item_id (FK, NOT NULL).
  const [mi] = await sql`
    INSERT INTO menu_items (cook_id, mode, title, unit_price, photos, total_slots, is_active)
    VALUES (${cookProfileId}, 'meals', 'Reconcile Test Dish', 2500, ${['https://res.cloudinary.com/demo/image/upload/sample.jpg']}, 100, true) RETURNING id`;

  const refPaid = 'RECON-PAID-' + Date.now();
  const refUnpaid = 'RECON-UNPAID-' + Date.now();
  const refError = 'RECON-ERROR-' + Date.now();
  let paidId, unpaidId, errorId;

  try {
    paidId   = await seedOrder(customer, cookProfileId, mi.id, refPaid);
    unpaidId = await seedOrder(customer, cookProfileId, mi.id, refUnpaid);
    errorId  = await seedOrder(customer, cookProfileId, mi.id, refError);

    // Stub the gateway verifier: map by reference to each branch.
    const verifyCharge = async ({ reference }) => {
      if (reference === refPaid)   return { successful: true,  devMode: false };
      if (reference === refUnpaid) return { successful: false, devMode: false };
      if (reference === refError)  throw new Error('simulated gateway timeout');
      return { successful: false, devMode: false };
    };

    const summary = await reconcilePendingPayments({ verifyCharge, olderThanMs: 15 * 60 * 1000 });
    check('summary counts (1 recovered, 1 cancelled, 1 deferred)',
      summary.recovered >= 1 && summary.cancelled >= 1 && summary.deferred >= 1,
      JSON.stringify(summary));

    const [pRow] = await sql`SELECT status FROM orders WHERE id = ${paidId}`;
    check('paid order → payment_confirmed', pRow.status === 'payment_confirmed', pRow.status);

    const [uRow] = await sql`SELECT status FROM orders WHERE id = ${unpaidId}`;
    check('unpaid order → cancelled', uRow.status === 'cancelled', uRow.status);

    const [eRow] = await sql`SELECT status FROM orders WHERE id = ${errorId}`;
    check('verify-errored order → still pending_payment (deferred)', eRow.status === 'pending_payment', eRow.status);

    // The recovered order must have posted a balanced capture draining
    // gateway_clearing into the cook's escrow.
    const legs = await sql`
      SELECT le.direction, le.amount_minor, la.account_type, la.owner_type
      FROM ledger_entries le JOIN ledger_accounts la ON la.id = le.account_id
      WHERE le.ref = ${'order-capture:' + paidId}`;
    const debit = legs.filter(l => l.direction === 'debit');
    const credit = legs.filter(l => l.direction === 'credit');
    const sum = a => a.reduce((s, l) => s + Number(l.amount_minor), 0);
    check('recovered order posted balanced capture', legs.length >= 2 && sum(debit) === sum(credit), `${legs.length} legs D${sum(debit)}=C${sum(credit)}`);
    const src = debit.find(l => l.account_type === 'gateway_clearing' && l.owner_type === 'platform');
    check('capture debits gateway_clearing 259375', !!src && Number(src.amount_minor) === 259375, `${src?.amount_minor}`);
    const escrow = credit.find(l => l.account_type === 'escrow' && l.owner_type === 'cook');
    check('capture credits cook escrow 240625', !!escrow && Number(escrow.amount_minor) === 240625, `${escrow?.amount_minor}`);

    // Idempotency: a second pass must not re-touch already-resolved orders
    // (only the still-pending errored one is a candidate, and it errors again).
    const second = await reconcilePendingPayments({ verifyCharge, olderThanMs: 15 * 60 * 1000 });
    check('second pass leaves resolved orders alone (0 recovered, 0 cancelled)',
      second.recovered === 0 && second.cancelled === 0, JSON.stringify(second));
  } finally {
    for (const id of [paidId, unpaidId, errorId].filter(Boolean)) {
      await sql`DELETE FROM ledger_entries WHERE ref = ${'order-capture:' + id}`;
      await sql`DELETE FROM notifications WHERE (data->>'order_id') = ${id}`;
      await sql`DELETE FROM orders WHERE id = ${id}`;
    }
    await sql`DELETE FROM menu_items WHERE id = ${mi.id}`;
    await sql.end();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──── RECONCILIATION TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 52)} ${r.detail ?? ''}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e.message); process.exit(1); });
