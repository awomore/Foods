// Test for POST /api/auth/set-role idempotency.
//
// The mobile client replays a POST when the connection drops (client.ts:110
// retries any method on a network error). So a set-role that SUCCEEDS on the
// server can have its response lost and be replayed. With the original
// `WHERE role IS NULL` alone, that replay returned 409 and stranded the user on
// the role screen with their role already correctly saved — every subsequent
// tap repeating the failure. Observed in production 2026-09-08: one 200 at
// 20:06:03 followed by sixteen 409s.
//
// Exercises the route's exact SQL rather than the HTTP layer.
// EVERYTHING RUNS IN ONE TRANSACTION THAT IS ALWAYS ROLLED BACK.
//
// Usage: cd backend; node scripts/set-role-idempotent-test.js
require('dotenv').config();
if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
const { sql } = require('../supabase/db');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

// The handler's logic, verbatim in shape: UPDATE ... WHERE role IS NULL, then
// fall back to reading the existing row and comparing.
async function setRole(tx, userId, role) {
  const users = await tx`
    UPDATE users SET role = ${role} WHERE id = ${userId} AND role IS NULL RETURNING *
  `;
  let user = users[0];
  if (!user) {
    const [existing] = await tx`SELECT * FROM users WHERE id = ${userId}`;
    if (!existing) return { status: 404 };
    if (existing.role !== role) return { status: 409 };
    user = existing;
  }
  return { status: 200, role: user.role };
}

(async () => {
  await sql.begin(async (tx) => {
    const phone = '99900000' + Math.floor(Math.random() * 10000);
    const [u] = await tx`
      INSERT INTO users (phone, role) VALUES (${phone}, NULL) RETURNING *
    `;
    check('seeded a user with no role', u && u.role === null, `id=${u && u.id}`);

    const first = await setRole(tx, u.id, 'cook');
    check('first call sets the role', first.status === 200 && first.role === 'cook',
      `status ${first.status}`);

    // The replay: same request, arriving after the first already succeeded.
    const replay = await setRole(tx, u.id, 'cook');
    check('REPLAY of the same role succeeds (was 409)', replay.status === 200,
      `status ${replay.status}`);
    check('replay reports the role, not null', replay.role === 'cook', String(replay.role));

    // A genuine change must still be refused.
    const change = await setRole(tx, u.id, 'customer');
    check('changing to a different role still conflicts', change.status === 409,
      `status ${change.status}`);

    const [after] = await tx`SELECT role FROM users WHERE id = ${u.id}`;
    check('the refused change did not alter the row', after.role === 'cook', after.role);

    const missing = await setRole(tx, '00000000-0000-0000-0000-000000000000', 'cook');
    check('unknown user is 404, not a crash', missing.status === 404, `status ${missing.status}`);

    throw new Error('__rollback__');
  }).catch((e) => { if (e.message !== '__rollback__') throw e; });

  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM users WHERE phone LIKE '99900000%'
  `;
  check('rolled back — no seeded user committed', n === 0, `found ${n}`);

  await sql.end();

  const pad = (s, w) => String(s).padEnd(w);
  console.log('\n──── SET-ROLE IDEMPOTENCY TEST ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 46)} ${String(r.detail).slice(0, 44)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error('fatal:', e); process.exitCode = 1; });
