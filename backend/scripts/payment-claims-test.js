// Integration test for payments/claims.js (migration 069): a verified payment
// can be spent once, for one purpose, by its payer, up to its amount -- even
// when two requests race for it.
// Usage: cd backend; node scripts/payment-claims-test.js
require('dotenv').config();
require('./lib/assert-not-production').assertNotProduction('payment-claims-test');
const { sql } = require('../supabase/db');
const { PaymentError, verifyPayment, consumeClaim } = require('../payments/claims');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

async function ensureUser(phone, name) {
  const ex = await sql`SELECT id FROM users WHERE phone = ${phone}`;
  if (ex.length) return ex[0].id;
  const [u] = await sql`INSERT INTO users (full_name, phone, role, is_active) VALUES (${name}, ${phone}, 'customer', true) RETURNING id`;
  return u.id;
}

// Resolves to the PaymentError status, or 'ok'.
async function outcome(fn) {
  try { await fn(); return 'ok'; } catch (e) { if (e instanceof PaymentError) return e.status; throw e; }
}

(async () => {
  const alice = await ensureUser('+2349900000811', 'E2E Claims Alice');
  const bob   = await ensureUser('+2349900000812', 'E2E Claims Bob');
  const stamp = Date.now();
  const refs = [];
  const ref = name => { const r = `CLAIMS-${name}-${stamp}`; refs.push(r); return r; };

  try {
    // ── verifyPayment ──────────────────────────────────────────────────────
    const charge = (over = {}) => async () => ({ successful: true, devMode: false, amount: 5000, currency: 'NGN', meta: { user_id: alice }, ...over });
    const v = (over, p = {}) => outcome(() => verifyPayment(
      { reference: 'X', userId: alice, currency: 'NGN', amountMinor: 500000, ...p },
      { verify: charge(over), isProduction: true }));

    check('verify: good charge passes', await v({}) === 'ok');
    check('verify: failed charge → 400', await v({ successful: false }) === 400);
    check('verify: wrong currency → 400', await v({ currency: 'GHS' }) === 400);
    check('verify: missing currency → 400', await v({ currency: undefined }) === 400);
    check('verify: underpaid → 400', await v({ amount: 4999.99 }) === 400);
    check("verify: someone else's charge → 403", await v({ meta: { user_id: bob } }) === 403);
    check('verify: charge naming no payer (older app builds) passes', await v({ meta: {} }) === 'ok');
    check('verify: charge with no meta at all passes', await v({ meta: undefined }) === 'ok');
    check('verify: dev-mode mock in production → 503', await v({ devMode: true, successful: true }) === 503);
    check('verify: missing reference → 400', await v({}, { reference: undefined }) === 400);
    const { paidMinor } = await verifyPayment({ reference: 'X', userId: alice, currency: 'NGN', amountMinor: 100 },
      { verify: charge({ amount: 5000 }), isProduction: true });
    check('verify: reports the full amount paid', paidMinor === 500000, String(paidMinor));

    // ── consumeClaim ───────────────────────────────────────────────────────
    const use = (reference, p) => outcome(() => sql.begin(tx => consumeClaim(tx, {
      reference, purpose: 'gift_card', userId: alice, currency: 'NGN', paidMinor: 500000, useMinor: 500000, ...p,
    })));

    const once = ref('once');
    check('claim: first use succeeds', await use(once) === 'ok');
    check('claim: same payment again → 409', await use(once) === 409);
    check('claim: same payment, other purpose → 409', await use(once, { purpose: 'wallet_topup' }) === 409);

    const other = ref('other');
    check('claim: first use succeeds (2)', await use(other) === 'ok');
    check("claim: another user can't spend it → 409", await use(other, { userId: bob, useMinor: 0 }) === 409);

    const cur = ref('currency');
    check('claim: opened in NGN', await use(cur, { useMinor: 100 }) === 'ok');
    check('claim: drawing it in GHS → 409', await use(cur, { currency: 'GHS', useMinor: 100 }) === 409);

    // A wallet debit opened at 1000 pays orders worth at most 1000 in total.
    const cart = ref('cart');
    const draw = m => use(cart, { purpose: 'wallet_order', paidMinor: 1000, useMinor: m });
    check('cart: order 1 (600 of 1000)', await draw(600) === 'ok');
    check('cart: order 2 (400 of remaining 400)', await draw(400) === 'ok');
    check('cart: order 3 (1 more) → 409', await draw(1) === 409);
    const [row] = await sql`SELECT amount_minor, consumed_minor FROM payment_claims WHERE reference = ${cart}`;
    check('cart: claim fully consumed', Number(row.consumed_minor) === 1000 && Number(row.amount_minor) === 1000, JSON.stringify(row));

    // Two requests racing to spend the same payment: exactly one wins.
    const race = ref('race');
    const raced = await Promise.all([use(race), use(race), use(race)]);
    check('race: exactly one of three concurrent spends wins',
      raced.filter(r => r === 'ok').length === 1 && raced.filter(r => r === 409).length === 2, JSON.stringify(raced));

    // The table itself refuses overspending, whatever the caller does.
    const direct = await sql`UPDATE payment_claims SET consumed_minor = amount_minor + 1 WHERE reference = ${once}`
      .then(() => 'updated', e => e.code);
    check('table: CHECK constraint blocks consumed > amount', direct === '23514', direct);
  } finally {
    await sql`DELETE FROM payment_claims WHERE reference = ANY(${refs})`;
    await sql.end();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n──── PAYMENT CLAIMS TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 52)} ${r.detail ?? ''}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('test error:', e.message); process.exit(1); });
