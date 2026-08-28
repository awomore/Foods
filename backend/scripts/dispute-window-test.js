// Drives POST /api/disputes and PATCH /api/orders/:id in-process against the DEV
// database, to pin down how long a customer has to raise a dispute.
//
// This number was previously written four times — 30 minutes in disputes.js, 30
// as minutes in orders.js, a bare `30 * 60000` further down the same file, and
// 24 hours on the Terms page — and they disagreed. It now comes from
// utils/disputeWindow, and this suite fails if a route stops using it or if the
// window silently changes.
require('dotenv').config();
const express = require('express');
const jwt     = require('jsonwebtoken');
const { sql } = require('../supabase/db');
const { DISPUTE_WINDOW_HOURS, DISPUTE_WINDOW_MS, disputeWindowClosesAt } = require('../utils/disputeWindow');

const CUSTOMER = '2349099000041';
const COOK     = '2349099000042';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

let BASE, customerId, cookUserId, cookProfileId, customerToken;
const orderIds = [];

async function wipe() {
  if (orderIds.length) {
    await sql`DELETE FROM disputes WHERE order_id = ANY(${orderIds}::uuid[])`.catch(() => {});
    await sql`DELETE FROM orders WHERE id = ANY(${orderIds}::uuid[])`.catch(() => {});
  }
  await sql`DELETE FROM users WHERE phone = ANY(${[CUSTOMER, COOK]}::text[])`;
}

/** An order sitting in whatever delivered-state the test needs. */
async function makeOrder({ status, deliveredAt, windowClosesAt }) {
  const [o] = await sql`
    INSERT INTO orders (customer_id, cook_id, unit_price, subtotal, total_amount, cook_payout,
                        status, delivered_at, dispute_window_closes_at)
    VALUES (${customerId}, ${cookProfileId}, 1000, 1000, 1000, 800,
            ${status}, ${deliveredAt ?? null}::timestamptz, ${windowClosesAt ?? null}::timestamptz)
    RETURNING id`;
  orderIds.push(o.id);
  return o.id;
}

async function fileDispute(orderId) {
  const res = await fetch(`${BASE}/api/disputes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerToken}` },
    body: JSON.stringify({ order_id: orderId, type: 'item_missing', reason: 'E2E window test' }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

(async () => {
  // The constant itself, before any HTTP.
  check(`the window is ${DISPUTE_WINDOW_HOURS} hours`, DISPUTE_WINDOW_HOURS === 24,
    String(DISPUTE_WINDOW_HOURS));
  check('the helper adds exactly that much',
    disputeWindowClosesAt(new Date('2026-01-01T00:00:00Z')).toISOString() === '2026-01-02T00:00:00.000Z',
    disputeWindowClosesAt(new Date('2026-01-01T00:00:00Z')).toISOString());

  const app = express();
  app.use(express.json());
  app.use('/api/disputes', require('../routes/disputes'));
  app.use('/api/orders', require('../routes/orders'));
  const server = app.listen(0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  try {
    await wipe();

    customerId = (await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES ('E2E Window Customer', ${CUSTOMER}, 'customer', true) RETURNING id`)[0].id;
    cookUserId = (await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES ('E2E Window Cook', ${COOK}, 'cook', true) RETURNING id`)[0].id;
    cookProfileId = (await sql`
      INSERT INTO cook_profiles (user_id, display_name, username)
      VALUES (${cookUserId}, 'E2E Window Cook', 'e2ewindowcook') RETURNING id`)[0].id;
    customerToken = jwt.sign({ userId: customerId }, process.env.JWT_SECRET, { expiresIn: '10m' });

    // 1. Just delivered — well inside the window.
    let id = await makeOrder({
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
      windowClosesAt: disputeWindowClosesAt().toISOString(),
    });
    let r = await fileDispute(id);
    check('a dispute filed right after delivery is accepted', r.status === 201 || r.status === 200,
      `${r.status} ${r.body.error ?? ''}`);

    // 2. Twelve hours later — the case the old 30-minute rule wrongly refused.
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    id = await makeOrder({
      status: 'delivered',
      deliveredAt: twelveHoursAgo.toISOString(),
      windowClosesAt: disputeWindowClosesAt(twelveHoursAgo).toISOString(),
    });
    r = await fileDispute(id);
    check('12 hours after delivery is still accepted', r.status === 201 || r.status === 200,
      `${r.status} ${r.body.error ?? ''}`);

    // 3. Past the window — refused, and the message must quote the real number.
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    id = await makeOrder({
      status: 'delivered',
      deliveredAt: twoDaysAgo.toISOString(),
      windowClosesAt: disputeWindowClosesAt(twoDaysAgo).toISOString(),
    });
    r = await fileDispute(id);
    check('past the window it is refused with 409', r.status === 409, String(r.status));
    check('and the refusal quotes the real window',
      typeof r.body.error === 'string' && r.body.error.includes(`${DISPUTE_WINDOW_HOURS} hours`),
      String(r.body.error).slice(0, 60));

    // 4. Legacy rows have no dispute_window_closes_at and must fall back to
    //    delivered_at + the window, not to "no window at all".
    id = await makeOrder({ status: 'delivered', deliveredAt: twoDaysAgo.toISOString(), windowClosesAt: null });
    r = await fileDispute(id);
    check('a legacy row with no stored window still closes', r.status === 409, String(r.status));

    id = await makeOrder({ status: 'delivered', deliveredAt: twelveHoursAgo.toISOString(), windowClosesAt: null });
    r = await fileDispute(id);
    check('and a recent legacy row is still accepted', r.status === 201 || r.status === 200,
      `${r.status} ${r.body.error ?? ''}`);

    // 5. Marking an order delivered through the route must stamp the window.
    //    This is the write path that had its own hardcoded copy of the number.
    const cookToken = jwt.sign({ userId: cookUserId }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const fresh = await makeOrder({ status: 'in_transit', deliveredAt: null, windowClosesAt: null });
    const patch = await fetch(`${BASE}/api/orders/${fresh}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cookToken}` },
      body: JSON.stringify({ status: 'delivered' }),
    });
    const [row] = await sql`SELECT dispute_window_closes_at, delivered_at FROM orders WHERE id = ${fresh}`;
    const gap = row.dispute_window_closes_at
      ? new Date(row.dispute_window_closes_at).getTime() - Date.now()
      : null;
    check('marking delivered stamps a window', patch.status === 200 && gap !== null, String(patch.status));
    // Within a minute of the expected offset — the route stamps it from its own clock.
    check(`and the stamp is ${DISPUTE_WINDOW_HOURS} hours out`,
      gap !== null && Math.abs(gap - DISPUTE_WINDOW_MS) < 60_000,
      gap === null ? 'not stamped' : `${(gap / 3600000).toFixed(2)}h`);

  } finally {
    await wipe();
    server.close();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(58)} ${String(r.detail).slice(0, 60)}`);
  }
  console.log(`\n${results.length} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });
