// Drives POST /api/auth/verify-otp in-process against the DEV database to pin the
// behaviour of the env-gated App Review login (APP_REVIEW_PHONE / APP_REVIEW_OTP).
//
// What this guards:
//  - inert by default: with the env vars unset, the review number gets no special
//    treatment and still needs a real otp_codes row;
//  - when both vars are set, that exact number + code logs in with NO otp_codes
//    row present (the point — a reviewer has no SMS);
//  - it is scoped: a different number, or the wrong code, is still rejected;
//  - it is independent of NODE_ENV (works even when NODE_ENV=production).
require('dotenv').config();
const express = require('express');
const { sql } = require('../supabase/db');

const REVIEW_PHONE = '2340000009999'; // throwaway, not the real review number
const OTHER_PHONE  = '2340000008888';
const REVIEW_CODE  = '000000';
const ALL = [REVIEW_PHONE, OTHER_PHONE];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

async function wipe() {
  await sql`DELETE FROM otp_codes WHERE phone = ANY(${ALL}::text[])`;
  await sql`DELETE FROM users WHERE phone = ANY(${ALL}::text[])`;
}

let BASE;
async function verify(phone, otp) {
  const res = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, tos_accepted: true }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  const server = app.listen(0);
  BASE = `http://127.0.0.1:${server.address().port}`;

  const savedPhone = process.env.APP_REVIEW_PHONE;
  const savedOtp   = process.env.APP_REVIEW_OTP;
  const savedEnv   = process.env.NODE_ENV;

  try {
    await wipe();

    // 1. Vars unset — no special treatment, no seeded code → rejected.
    delete process.env.APP_REVIEW_PHONE;
    delete process.env.APP_REVIEW_OTP;
    let r = await verify(REVIEW_PHONE, REVIEW_CODE);
    check('inert by default: review number rejected with no env vars',
      r.status === 400, `${r.status}`);

    // 2. Both vars set — that exact number + code logs in, with NO otp_codes row.
    //    Also force NODE_ENV=production to prove it is not the dev-only path.
    process.env.APP_REVIEW_PHONE = REVIEW_PHONE;
    process.env.APP_REVIEW_OTP   = REVIEW_CODE;
    process.env.NODE_ENV         = 'production';
    r = await verify(REVIEW_PHONE, REVIEW_CODE);
    check('with vars set, review login succeeds without an OTP row',
      r.status === 200 && typeof r.body.token === 'string', `${r.status}`);
    check('review login creates/uses a real user row',
      Boolean(r.body.user?.id), `id ${r.body.user?.id}`);
    const rows = await sql`SELECT COUNT(*)::int AS n FROM otp_codes WHERE phone = ${REVIEW_PHONE}`;
    check('no otp_codes row was required', rows[0].n === 0, `${rows[0].n} rows`);

    // 3. Scoped to that one number — a different number with the review code fails.
    r = await verify(OTHER_PHONE, REVIEW_CODE);
    check('a different number with the review code is rejected',
      r.status === 400, `${r.status}`);

    // 4. Scoped to that one code — the review number with a wrong code fails.
    r = await verify(REVIEW_PHONE, '123456');
    check('the review number with the wrong code is rejected',
      r.status === 400, `${r.status}`);

    await wipe();
  } catch (err) {
    check('no exception', false, err.message);
  } finally {
    if (savedPhone === undefined) delete process.env.APP_REVIEW_PHONE; else process.env.APP_REVIEW_PHONE = savedPhone;
    if (savedOtp === undefined)   delete process.env.APP_REVIEW_OTP;   else process.env.APP_REVIEW_OTP = savedOtp;
    if (savedEnv === undefined)   delete process.env.NODE_ENV;         else process.env.NODE_ENV = savedEnv;
    server.close();
  }

  const failed = results.filter(r => !r.ok);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
