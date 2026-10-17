// Integration test for payments/tips.js: a tip reaches a cook's payout
// ('pending') only once a payment for it has been verified and spent.
// Usage: cd backend; node scripts/tips-payment-test.js
require('dotenv').config();
require('./lib/assert-not-production').assertNotProduction('tips-payment-test');
const { sql } = require('../supabase/db');
const { PaymentError } = require('../payments/claims');
const { recordPaidTip, recordCheckoutTip, settleCheckoutTips, splitTip } = require('../payments/tips');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

async function ensureUser(phone, name) {
  const ex = await sql`SELECT id FROM users WHERE phone = ${phone}`;
  if (ex.length) return ex[0].id;
  const [u] = await sql`INSERT INTO users (full_name, phone, role, is_active) VALUES (${name}, ${phone}, 'customer', true) RETURNING id`;
  return u.id;
}

async function outcome(fn) {
  try { await fn(); return 'ok'; } catch (e) { if (e instanceof PaymentError) return e.status; throw e; }
}

(async () => {
  const alice = await ensureUser('+2349900000821', 'E2E Tips Alice');
  const cook = (await sql`SELECT id FROM cook_profiles LIMIT 1`)[0]?.id;
  if (!cook) throw new Error('dev database has no cook_profiles row to tip');
  const stamp = Date.now();
  const refs = [];
  const ref = name => { const r = `TIPS-${name}-${stamp}`; refs.push(r); return r; };
  const charge = (over = {}) => async () => ({ successful: true, devMode: false, amount: 500, currency: 'NGN', meta: { user_id: alice }, ...over });
  const card = (txRef, over, p = {}) => outcome(() => recordPaidTip(sql,
    { userId: alice, cookId: cook, amount: 500, currency: 'NGN', txRef, ...p },
    { verify: charge(over), isProduction: true }));
  const statusOf = async txRef => (await sql`SELECT payout_status FROM tips WHERE flutterwave_tx_ref = ${txRef}`).map(t => t.payout_status);
  const openClaim = (reference, purpose, amountMinor) => sql`
    INSERT INTO payment_claims (reference, purpose, user_id, currency, amount_minor)
    VALUES (${reference}, ${purpose}, ${alice}, 'NGN', ${amountMinor})`;

  try {
    // ── standalone tips ────────────────────────────────────────────────────
    check('tip: no payment reference → 400', await card(undefined, {}) === 400);
    check('tip: zero amount → 400', await card(ref('zero'), {}, { amount: 0 }) === 400);
    check('tip: failed charge → 400', await card(ref('failed'), { successful: false }) === 400);
    check('tip: charge smaller than the tip → 400', await card(ref('under'), { amount: 499 }) === 400);
    check('tip: dev-mode mock in production → 503', await card(ref('mock'), { devMode: true }) === 503);

    const paid = ref('paid');
    check('tip: verified card charge records it', await card(paid, {}) === 'ok');
    check('tip: recorded as pending (joins payout)', JSON.stringify(await statusOf(paid)) === '["pending"]');
    check('tip: same charge twice → 409', await card(paid, {}) === 409);
    check('tip: still exactly one row', (await statusOf(paid)).length === 1);

    // Wallet tips spend a /wallet/pay debit (claim purpose wallet_order).
    const wallet = ref('wallet');
    await openClaim(wallet, 'wallet_order', 50000);
    const w = () => outcome(() => recordPaidTip(sql, { userId: alice, cookId: cook, amount: 500, currency: 'NGN', txRef: wallet, paymentMethod: 'wallet' }));
    check('wallet tip: debit covers it', await w() === 'ok');
    check('wallet tip: debit already spent → 409', await w() === 409);
    check('wallet tip: an invented reference → 409', await outcome(() => recordPaidTip(sql,
      { userId: alice, cookId: cook, amount: 500, currency: 'NGN', txRef: ref('invented'), paymentMethod: 'wallet' })) === 409);

    // ── splitTip ───────────────────────────────────────────────────────────
    const split = splitTip(1001, [{ id: 'a', subtotal_minor: 3000 }, { id: 'b', subtotal_minor: 1000 }]);
    check('split: proportional, remainder to first, sums exactly',
      split[0].minor === 751 && split[1].minor === 250 && split[0].minor + split[1].minor === 1001, JSON.stringify(split.map(s => s.minor)));

    // ── checkout tips ──────────────────────────────────────────────────────
    const order = { id: null, cook_id: cook, currency_code: 'NGN', subtotal_minor: 100000 };

    // Card order: tip waits, then settles on what the orders left of the charge.
    const ck = ref('checkout');
    await recordCheckoutTip(sql, { userId: alice, orders: [order], tipAmount: 200, txRef: ck, isWalletPaid: false });
    check('checkout card tip: waits as awaiting_payment', JSON.stringify(await statusOf(ck)) === '["awaiting_payment"]');
    await openClaim(ck, 'order', 123750);                       // charge 1237.50
    await sql`UPDATE payment_claims SET consumed_minor = 103750 WHERE reference = ${ck}`; // orders took 1037.50
    await settleCheckoutTips(sql, ck);
    check('checkout card tip: settles to pending', JSON.stringify(await statusOf(ck)) === '["pending"]');

    const short = ref('short');
    await recordCheckoutTip(sql, { userId: alice, orders: [order], tipAmount: 200, txRef: short, isWalletPaid: false });
    await openClaim(short, 'order', 103750);
    await sql`UPDATE payment_claims SET consumed_minor = 103750 WHERE reference = ${short}`; // nothing left
    await settleCheckoutTips(sql, short);
    check('checkout card tip: charge with no room left → void', JSON.stringify(await statusOf(short)) === '["void"]');

    const cancelled = ref('cancelled');
    await recordCheckoutTip(sql, { userId: alice, orders: [order], tipAmount: 200, txRef: cancelled, isWalletPaid: false });
    await settleCheckoutTips(sql, cancelled, { voidAll: true });
    check('checkout card tip: orders cancelled → void', JSON.stringify(await statusOf(cancelled)) === '["void"]');

    // Wallet order: the tip spends the same debit at once.
    const wk = ref('walletcheckout');
    await openClaim(wk, 'wallet_order', 20000);
    await recordCheckoutTip(sql, { userId: alice, orders: [order], tipAmount: 200, txRef: wk, isWalletPaid: true });
    check('checkout wallet tip: pending at once', JSON.stringify(await statusOf(wk)) === '["pending"]');
    const wk2 = ref('walletshort');
    await openClaim(wk2, 'wallet_order', 100);
    await recordCheckoutTip(sql, { userId: alice, orders: [order], tipAmount: 200, txRef: wk2, isWalletPaid: true });
    check('checkout wallet tip: debit too small → no tip row', (await statusOf(wk2)).length === 0);
  } finally {
    await sql`DELETE FROM tips WHERE flutterwave_tx_ref = ANY(${refs})`;
    await sql`DELETE FROM payment_claims WHERE reference = ANY(${refs})`;
    await sql.end();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──── TIPS PAYMENT TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 58)} ${r.detail ?? ''}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e.message); process.exit(1); });
