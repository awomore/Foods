// Integration test for payout settlement + reconciliation (the transfer /
// money-OUT side). Drives settlePayoutSuccess / settlePayoutFailure and
// reconcileProcessingPayouts against real DB rows with a stubbed gateway.
// Deterministic, offline (postgres driver, no HTTP/gateway).
// Usage: cd backend; node scripts/payout-settlement-test.js
require('dotenv').config();
const crypto = require('crypto');
const { sql } = require('../supabase/db');
const ledger = require('../payments/ledger');
const { settlePayoutSuccess, settlePayoutFailure } = require('../payments/payoutSettlement');
const { reconcileProcessingPayouts } = require('../services/reconcilePayouts');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

const DRAW = 240625; // orders-portion draw-down, minor units

async function ensureUser(phone, name, role) {
  const ex = await sql`SELECT id FROM users WHERE phone = ${phone}`;
  if (ex.length) return ex[0].id;
  const [u] = await sql`INSERT INTO users (full_name, phone, role, is_active) VALUES (${name}, ${phone}, ${role}, true) RETURNING id`;
  return u.id;
}

// Seed a processing payout + one queued order + the accept-time ledger draw-down
// (cook earnings → platform gateway_clearing), so success/failure can act on it.
async function seedPayout(cookProfileId, menuItemId, customer, { txId = '', ageMin = 0, withDraw = true } = {}) {
  const [p] = await sql`
    INSERT INTO payouts (cook_id, amount, currency_code, type, instant_fee, status,
                         amount_minor, instant_fee_minor, flutterwave_transfer_id, created_at)
    VALUES (${cookProfileId}, 2406.25, 'NGN', 'standard', 0, 'processing',
            ${DRAW}, 0, ${txId}, NOW() - (${ageMin} || ' minutes')::interval)
    RETURNING id`;
  const [o] = await sql`
    INSERT INTO orders (customer_id, cook_id, menu_item_id, currency_code, order_type,
                        status, quantity, unit_price, subtotal, platform_fee, total_amount, cook_payout,
                        cook_payout_minor, payout_status, payout_batch_id, created_at)
    VALUES (${customer}, ${cookProfileId}, ${menuItemId}, 'NGN', 'preorder',
            'delivered', 1, 2500, 2500, 93.75, 2593.75, 2406.25,
            ${DRAW}, 'queued', ${p.id}, NOW())
    RETURNING id`;
  if (withDraw) {
    await sql.begin(async sql => {
      const earnings = await ledger.ensureAccount(sql, { ownerType: 'cook', ownerId: cookProfileId, accountType: 'earnings', currency: 'NGN' });
      const gateway  = await ledger.ensureAccount(sql, { ownerType: 'platform', accountType: 'gateway_clearing', currency: 'NGN' });
      await ledger.post(sql, {
        transactionId: crypto.randomUUID(), currency: 'NGN', entryType: 'payout',
        description: 'Cook payout', ref: `payout:${p.id}`,
        legs: [
          { accountId: earnings, direction: 'debit',  amount_minor: DRAW },
          { accountId: gateway,  direction: 'credit', amount_minor: DRAW },
        ],
      });
    });
  }
  return { payoutId: p.id, orderId: o.id };
}

async function ledgerNet(ref) {
  const rows = await sql`SELECT direction, amount_minor FROM ledger_entries WHERE ref = ${ref}`;
  return rows;
}

(async () => {
  const customer = await ensureUser('+2349900000801', 'E2E Test Customer', 'customer');
  const cook     = await ensureUser('+2349900000802', 'E2E Test Cook', 'cook');
  const [cp] = await sql`SELECT id FROM cook_profiles WHERE user_id = ${cook}`;
  const cookProfileId = cp?.id;
  if (!cookProfileId) { console.error('no cook profile — run e2e-harness first'); process.exit(1); }
  const [mi] = await sql`
    INSERT INTO menu_items (cook_id, mode, title, unit_price, photos, total_slots, is_active)
    VALUES (${cookProfileId}, 'meals', 'Payout Test Dish', 2500, ${['https://res.cloudinary.com/demo/image/upload/sample.jpg']}, 100, true)
    RETURNING id`;

  const created = [];
  try {
    // ── 1. Webhook success path ────────────────────────────────────────────
    const A = await seedPayout(cookProfileId, mi.id, customer); created.push(A);
    const r1 = await settlePayoutSuccess(sql, A.payoutId);
    check('success: settled', r1.settled === true);
    const [pa] = await sql`SELECT status, processed_at FROM payouts WHERE id = ${A.payoutId}`;
    check('success: payout completed + processed_at', pa.status === 'completed' && !!pa.processed_at, pa.status);
    const [oa] = await sql`SELECT payout_status FROM orders WHERE id = ${A.orderId}`;
    check('success: order marked paid', oa.payout_status === 'paid', oa.payout_status);
    const r1b = await settlePayoutSuccess(sql, A.payoutId);
    check('success: idempotent (2nd call noop)', r1b.settled === false);

    // ── 2. Webhook failure path (with ledger reversal) ─────────────────────
    const B = await seedPayout(cookProfileId, mi.id, customer); created.push(B);
    const r2 = await settlePayoutFailure(sql, B.payoutId, 'test failure');
    check('failure: settled', r2.settled === true);
    const [pb] = await sql`SELECT status, failure_reason FROM payouts WHERE id = ${B.payoutId}`;
    check('failure: payout failed + reason', pb.status === 'failed' && pb.failure_reason === 'test failure', pb.status);
    const [ob] = await sql`SELECT payout_status, payout_batch_id FROM orders WHERE id = ${B.orderId}`;
    check('failure: order reverted to pending + unbatched', ob.payout_status === 'pending' && ob.payout_batch_id === null, ob.payout_status);
    // The cook's earnings account specifically must return to its pre-draw-down
    // state: draw-down debited it, reversal must credit it the same amount.
    const earnLegs = await sql`
      SELECT le.direction, le.amount_minor
      FROM ledger_entries le JOIN ledger_accounts la ON la.id = le.account_id
      WHERE le.ref IN (${'payout:' + B.payoutId}, ${'payout-reversal:' + B.payoutId})
        AND la.account_type = 'earnings' AND la.owner_type = 'cook'`;
    const net = a => a.reduce((s, l) => s + (l.direction === 'credit' ? Number(l.amount_minor) : -Number(l.amount_minor)), 0);
    const hasDebit  = earnLegs.some(l => l.direction === 'debit'  && Number(l.amount_minor) === DRAW);
    const hasCredit = earnLegs.some(l => l.direction === 'credit' && Number(l.amount_minor) === DRAW);
    check('failure: reversal credits cook earnings back to 0', earnLegs.length === 2 && hasDebit && hasCredit && net(earnLegs) === 0, `earnings net ${net(earnLegs)}`);
    const r2b = await settlePayoutFailure(sql, B.payoutId, 'again');
    check('failure: idempotent (2nd call noop)', r2b.settled === false);

    // ── 3. Reconciliation (dropped transfer webhook) ───────────────────────
    const C = await seedPayout(cookProfileId, mi.id, customer, { txId: 'fw_c', ageMin: 20 }); created.push(C);
    const D = await seedPayout(cookProfileId, mi.id, customer, { txId: 'fw_d', ageMin: 20 }); created.push(D);
    const E = await seedPayout(cookProfileId, mi.id, customer, { txId: 'fw_e', ageMin: 20 }); created.push(E);
    const F = await seedPayout(cookProfileId, mi.id, customer, { txId: 'fw_f', ageMin: 1 });  created.push(F); // too new

    const verifyTransfer = async (id) => {
      if (id === 'fw_c') return { status: 'completed' };
      if (id === 'fw_d') return { status: 'failed' };
      return { status: 'pending' }; // fw_e (and fw_f isn't polled — too new)
    };
    const summary = await reconcileProcessingPayouts({ verifyTransfer, olderThanMs: 15 * 60 * 1000 });
    check('reconcile: summary (>=1 completed, >=1 failed, >=1 deferred)',
      summary.completed >= 1 && summary.failed >= 1 && summary.deferred >= 1, JSON.stringify(summary));
    const [pc] = await sql`SELECT status FROM payouts WHERE id = ${C.payoutId}`;
    check('reconcile: completed → completed', pc.status === 'completed', pc.status);
    const [pd] = await sql`SELECT status FROM payouts WHERE id = ${D.payoutId}`;
    check('reconcile: failed → failed', pd.status === 'failed', pd.status);
    const [pe] = await sql`SELECT status FROM payouts WHERE id = ${E.payoutId}`;
    check('reconcile: pending → stays processing', pe.status === 'processing', pe.status);
    const [pf] = await sql`SELECT status FROM payouts WHERE id = ${F.payoutId}`;
    check('reconcile: too-new payout skipped (still processing)', pf.status === 'processing', pf.status);
  } finally {
    for (const c of created) {
      await sql`DELETE FROM ledger_entries WHERE ref IN (${'payout:' + c.payoutId}, ${'payout-reversal:' + c.payoutId})`;
      await sql`DELETE FROM orders WHERE id = ${c.orderId}`;
      await sql`DELETE FROM payouts WHERE id = ${c.payoutId}`;
    }
    await sql`DELETE FROM notifications WHERE user_id = ${cook} AND type IN ('payout_completed','payout_failed')`;
    await sql`DELETE FROM menu_items WHERE id = ${mi.id}`;
    await sql.end();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──── PAYOUT SETTLEMENT + RECONCILIATION TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 56)} ${r.detail ?? ''}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e.message); process.exit(1); });
