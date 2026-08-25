// Drives POST /api/auth/verify-otp and GET /api/cooks/customer-lookup in-process
// against the DEV database.
//
// The bug this guards: the lookup used a bare equality on the phone column, so a
// row stored '09099000011' was invisible to an app sending '2349099000011' and
// verify-otp created a SECOND account, leaving the first unreachable. It also
// guards the choice of key length — the last NINE digits of 090 9900 0011 and
// 080 9900 0011 are identical, and those are two different subscribers.
require('dotenv').config();
const express = require('express');
const jwt     = require('jsonwebtoken');
const { sql } = require('../supabase/db');
const { phoneKey } = require('../utils/phone');

// Same subscriber, two spellings.
const LOCAL = '09099000011';
const INTL  = '2349099000011';
// Different subscriber; shares the last NINE digits with LOCAL, not the last ten.
const NEIGHBOUR = '08099000011';
// Nobody at all.
const UNKNOWN = '2349099000099';
const COOK    = '2349900000811';
const ALL = [LOCAL, INTL, NEIGHBOUR, UNKNOWN, COOK];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

let BASE, originalId, cookToken;

async function wipe() {
  await sql`DELETE FROM otp_codes WHERE phone = ANY(${ALL}::text[])`;
  await sql`DELETE FROM users WHERE phone = ANY(${ALL}::text[])`;
}

async function seedOtp(phone, code) {
  await sql`
    INSERT INTO otp_codes (phone, code, expires_at, attempts)
    VALUES (${phone}, ${code}, NOW() + INTERVAL '10 minutes', 0)
    ON CONFLICT (phone) DO UPDATE
      SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, attempts = 0`;
}

async function verify(phone, code) {
  await seedOtp(phone, code);
  const res = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp: code, tos_accepted: true }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function countFor(phone) {
  const [row] = await sql`
    SELECT COUNT(*)::int AS n FROM users
     WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = ${phoneKey(phone)}`;
  return row.n;
}

(async () => {
  // The key itself, before any HTTP: the three spellings must agree, and the
  // neighbouring number must not.
  check('local and international spellings share a key',
    phoneKey(LOCAL) === phoneKey(INTL), `${phoneKey(LOCAL)} vs ${phoneKey(INTL)}`);
  check('spaced +234 form shares the key',
    phoneKey('+234 909 900 0011') === phoneKey(LOCAL), phoneKey('+234 909 900 0011'));
  check('different network prefix does NOT share the key',
    phoneKey(NEIGHBOUR) !== phoneKey(LOCAL), `${phoneKey(NEIGHBOUR)} vs ${phoneKey(LOCAL)}`);
  check('a nine-digit key WOULD have collided (why the key is ten)',
    LOCAL.slice(-9) === NEIGHBOUR.slice(-9), LOCAL.slice(-9));

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/cooks', require('../routes/cooks'));
  const server = app.listen(0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  try {
    await wipe();

    // The account as it exists today: stored in local form, and it is an admin —
    // exactly the row that went missing.
    originalId = (await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES ('E2E Phone Original', ${LOCAL}, 'admin', true) RETURNING id`)[0].id;

    // 1. Logging in with the international spelling must reach the SAME account.
    let r = await verify(INTL, '111111');
    check('international login finds the locally-stored account',
      r.status === 200 && r.body.user?.id === originalId,
      `${r.status} ${r.body.user?.id === originalId ? 'same id' : 'id ' + r.body.user?.id}`);
    check('and is not treated as a new user', r.body.is_new_user === false,
      String(r.body.is_new_user));
    check('and keeps the admin role', r.body.user?.role === 'admin', String(r.body.user?.role));

    // 2. The actual damage: no second row may appear.
    const after = await countFor(LOCAL);
    check('no duplicate account was created', after === 1, `${after} rows`);

    // 3. The stored spelling is left alone — this fix reads, it does not rewrite.
    const [still] = await sql`SELECT phone FROM users WHERE id = ${originalId}`;
    check('the stored number is not rewritten', still.phone === LOCAL, still.phone);

    // 4. A number nobody holds still registers normally.
    r = await verify(UNKNOWN, '222222');
    check('an unknown number still creates an account',
      r.status === 200 && r.body.is_new_user === true, `${r.status} ${r.body.is_new_user}`);

    // 5. The neighbouring subscriber must get their OWN account, not this one.
    r = await verify(NEIGHBOUR, '333333');
    const neighbourId = r.body.user?.id;
    check('a number sharing only nine digits gets its own account',
      r.status === 200 && r.body.is_new_user === true && neighbourId !== originalId,
      `${r.status} new=${r.body.is_new_user}`);

    // 6. Exact match still wins. With a duplicate already in the table — the state
    //    the old code left behind — logging in the way that made it must keep
    //    resolving to it, so nobody in flight is moved to a different row.
    const dupId = (await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES ('E2E Phone Duplicate', ${INTL}, 'customer', true) RETURNING id`)[0].id;
    r = await verify(INTL, '444444');
    check('an exact match still wins over the national key',
      r.body.user?.id === dupId, r.body.user?.id === dupId ? 'duplicate' : 'other');
    r = await verify(LOCAL, '555555');
    check('the other spelling still reaches the original',
      r.body.user?.id === originalId, r.body.user?.id === originalId ? 'original' : 'other');
    await sql`DELETE FROM users WHERE id = ${dupId}`;

    // 7. A cook looking a customer up hits the same mismatch.
    const cookId = (await sql`
      INSERT INTO users (full_name, phone, role, is_active)
      VALUES ('E2E Phone Cook', ${COOK}, 'cook', true) RETURNING id`)[0].id;
    cookToken = jwt.sign({ userId: cookId }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const lookup = await fetch(`${BASE}/api/cooks/customer-lookup?phone=${INTL}`,
      { headers: { Authorization: `Bearer ${cookToken}` } });
    const lookupBody = await lookup.json().catch(() => ({}));
    check('customer-lookup finds the locally-stored customer',
      lookup.status === 200 && lookupBody.user?.id === originalId,
      `${lookup.status} ${lookupBody.user?.id === originalId ? 'same id' : JSON.stringify(lookupBody).slice(0, 60)}`);

    const miss = await fetch(`${BASE}/api/cooks/customer-lookup?phone=2349099000077`,
      { headers: { Authorization: `Bearer ${cookToken}` } });
    check('customer-lookup still 404s on a real miss', miss.status === 404, String(miss.status));

    // 8. The hardcoded test-phone bypass must not work in production. It skips OTP
    //    entirely on a fixed code, and 2348000000001 has a real row in the
    //    production users table, so ungated it was an open door.
    const TEST_PHONE = '2348000000001';
    await sql`DELETE FROM otp_codes WHERE phone = ${TEST_PHONE}`;
    const bypass = async () => {
      const res = await fetch(`${BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: TEST_PHONE, otp: '000000', tos_accepted: true }),
      });
      return res.status;
    };

    const devStatus = await bypass();
    check('test-phone bypass still works outside production', devStatus === 200,
      String(devStatus));

    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const prodStatus = await bypass();
    if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior;
    check('test-phone bypass is CLOSED in production', prodStatus === 400,
      `${prodStatus} (400 = fell through to a real OTP check)`);

    await sql`DELETE FROM users WHERE phone = ${TEST_PHONE}`;

  } finally {
    await wipe();
    server.close();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(58)} ${String(r.detail).slice(0, 90)}`);
  }
  console.log(`\n${results.length} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });
