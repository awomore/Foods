// Proves make-admin.js against the DEV database.
//
// It grants the highest privilege in the system and writes to production, so the
// things worth proving are that it refuses to convert a real account by accident,
// that it is idempotent, and that the account it creates is one the app can
// actually log in to.
require('dotenv').config();
const { execFileSync } = require('child_process');
const path = require('path');
const express = require('express');
const { sql } = require('../supabase/db');

const SCRIPT = path.join(__dirname, 'make-admin.js');

const NEW_ADMIN = '2349099000031';
const IS_A_COOK = '2349099000032';
const NO_ROLE   = '2349099000033';
const ALL = [NEW_ADMIN, IS_A_COOK, NO_ROLE];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const wipe = () => sql`DELETE FROM users WHERE phone = ANY(${ALL}::text[])`;
const roleOf = async phone =>
  (await sql`SELECT role FROM users WHERE phone = ${phone}`)[0]?.role ?? '(none)';
const countOf = async phone =>
  (await sql`SELECT COUNT(*)::int n FROM users WHERE phone = ${phone}`)[0].n;

function run(...a) {
  try {
    return { out: execFileSync('node', [SCRIPT, ...a], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: (e.stdout || '') + (e.stderr || ''), code: e.status };
  }
}

(async () => {
  let server;
  try {
    await wipe();
    await sql`INSERT INTO users (full_name, phone, role, is_active)
              VALUES ('E2E Admin Cook', ${IS_A_COOK}, 'cook', true)`;
    await sql`INSERT INTO users (full_name, phone, role, is_active)
              VALUES ('E2E Admin NoRole', ${NO_ROLE}, NULL, true)`;

    // ── input validation ───────────────────────────────────────────────────
    check('a local-format number is rejected', run('09099000031').code === 1,
      'must be the form the app sends');
    check('no argument prints usage', run().code === 1);

    // ── dry run ────────────────────────────────────────────────────────────
    const dry = run(NEW_ADMIN, 'E2E New Admin');
    check('dry run says it would create', /Would CREATE a new admin/.test(dry.out));
    check('dry run wrote nothing', (await countOf(NEW_ADMIN)) === 0);

    // ── refuses to convert a real account ──────────────────────────────────
    const refused = run(IS_A_COOK, 'Nope', '--apply');
    check('refuses to promote an existing cook', refused.code === 1 && /REFUSED/.test(refused.out));
    check('and the cook is untouched', (await roleOf(IS_A_COOK)) === 'cook');
    check('and it explains why', /trade that account/.test(refused.out));

    // ── but --promote is honoured when meant ───────────────────────────────
    check('--promote converts it when explicitly asked',
      run(IS_A_COOK, '--promote', '--apply').code === 0 &&
      (await roleOf(IS_A_COOK)) === 'admin');

    // ── a role-less row is promoted without ceremony ───────────────────────
    check('a row with no role is promoted without --promote',
      run(NO_ROLE, '--apply').code === 0 && (await roleOf(NO_ROLE)) === 'admin');

    // ── create ─────────────────────────────────────────────────────────────
    const made = run(NEW_ADMIN, 'E2E New Admin', '--apply');
    check('creates the admin', made.code === 0 && (await roleOf(NEW_ADMIN)) === 'admin');
    check('exactly one row', (await countOf(NEW_ADMIN)) === 1);

    const [created] = await sql`SELECT full_name, is_active, tos_accepted_at, privacy_accepted_at
                                  FROM users WHERE phone = ${NEW_ADMIN}`;
    check('with the name given', created.full_name === 'E2E New Admin', created.full_name);
    check('active', created.is_active === true);
    check('and terms recorded, which verify-otp would otherwise never do',
      !!created.tos_accepted_at && !!created.privacy_accepted_at);

    // ── idempotent ─────────────────────────────────────────────────────────
    const again = run(NEW_ADMIN, 'E2E New Admin', '--apply');
    check('running it twice is a no-op', /Already an admin/.test(again.out) &&
      (await countOf(NEW_ADMIN)) === 1);

    // ── the account can actually log in ────────────────────────────────────
    // The point of the exercise: an admin row the app cannot reach is useless.
    const app = express();
    app.use(express.json());
    app.use('/api/auth', require('../routes/auth'));
    server = app.listen(0);
    const BASE = `http://127.0.0.1:${server.address().port}`;

    await sql`INSERT INTO otp_codes (phone, code, expires_at, attempts)
              VALUES (${NEW_ADMIN}, '123456', NOW() + INTERVAL '10 minutes', 0)
              ON CONFLICT (phone) DO UPDATE SET code = EXCLUDED.code,
                expires_at = EXCLUDED.expires_at, attempts = 0`;
    const res = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: NEW_ADMIN, otp: '123456' }),
    });
    const body = await res.json().catch(() => ({}));
    check('the new admin can log in', res.status === 200, String(res.status));
    check('login returns the admin role', body.user?.role === 'admin', String(body.user?.role));
    check('and is not treated as a new signup', body.is_new_user === false,
      String(body.is_new_user));

  } finally {
    await sql`DELETE FROM otp_codes WHERE phone = ANY(${ALL}::text[])`;
    await wipe();
    if (server) server.close();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(58)} ${String(r.detail).slice(0, 60)}`);
  }
  console.log(`\n${results.length} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });
