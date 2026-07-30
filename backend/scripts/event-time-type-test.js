// Integration test for migration 063 — catering_events.event_time and
// private_chef_bookings.event_time becoming `time` instead of text.
//
// Runs the actual INSERTs from routes/catering.js:20-43 and
// routes/privateChef.js:19-30 against the converted columns, and checks the
// thing the conversion is FOR: that the column itself now rejects a value that
// is not a time, rather than relying on every writer remembering the ::time cast.
//
// EVERYTHING RUNS IN ONE TRANSACTION THAT IS ALWAYS ROLLED BACK.
//
// Usage: cd backend; DATABASE_URL=<url> node scripts/event-time-type-test.js
//    or: railway run --service Postgres node scripts/event-time-type-test.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

async function expectReject(tx, name, fn) {
  try {
    await tx.savepoint(sp => fn(sp));
    check(name, false, 'accepted — column is not enforcing the type');
  } catch (e) {
    check(name, true, e.message.split('\n')[0].slice(0, 48));
  }
}

const PHONE = '+2349900008001';

(async () => {
  const sql = postgres(DB_URL, { ssl: 'require', max: 1, onnotice: () => {} });
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '063_event_time_type.sql'), 'utf8');

  try {
    await sql.begin(async tx => {
      const before = await tx`
        SELECT table_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND column_name='event_time'
          AND table_name IN ('catering_events','private_chef_bookings') ORDER BY table_name`;

      await tx.unsafe(migration);
      check('migration 063 applies', true, `was: ${before.map(b => b.data_type).join('/')}`);
      await tx.unsafe(migration);
      check('replaying 063 is a no-op', true);

      const after = await tx`
        SELECT table_name, data_type FROM information_schema.columns
        WHERE table_schema='public' AND column_name='event_time'
          AND table_name IN ('catering_events','private_chef_bookings') ORDER BY table_name`;
      check('both columns are now time',
        after.length === 2 && after.every(a => a.data_type === 'time without time zone'),
        after.map(a => `${a.table_name}=${a.data_type}`).join(' '));

      // ── Seed ────────────────────────────────────────────────────────────────
      const [cust] = await tx`INSERT INTO users (full_name, phone, role, is_active)
                              VALUES ('ET Customer', ${PHONE}, 'customer', true) RETURNING id`;
      const [cookUser] = await tx`INSERT INTO users (full_name, phone, role, is_active)
                                  VALUES ('ET Cook', '+2349900008002', 'cook', true) RETURNING id`;
      const [cook] = await tx`INSERT INTO cook_profiles (user_id, display_name, username)
                              VALUES (${cookUser.id}, 'ET Kitchen', 'etkitchen') RETURNING id`;

      // ── The real INSERT from routes/catering.js ─────────────────────────────
      const [event] = await tx`
        INSERT INTO catering_events (
          customer_id, cook_id, event_name, event_type, event_date, event_time,
          guest_count, venue_address
        ) VALUES (
          ${cust.id}, ${cook.id}, 'ET Party', 'birthday', ${'2026-08-01'}::date,
          ${'9:00'}::time, ${40}, '3 Test Road, Lagos'
        ) RETURNING *`;
      check('catering INSERT works and normalises 9:00 → 09:00:00',
        String(event.event_time).startsWith('09:00'), `${event.event_time}`);

      // ── The real INSERT from routes/privateChef.js ──────────────────────────
      const [booking] = await tx`
        INSERT INTO private_chef_bookings (
          customer_id, cook_id, event_type, event_date, event_time, guest_count, venue_address
        ) VALUES (
          ${cust.id}, ${cook.id}, 'dinner', ${'2026-08-02'}::date,
          ${'19:30'}::time, ${8}, '4 Test Road, Lagos'
        ) RETURNING *`;
      check('private chef INSERT works', String(booking.event_time).startsWith('19:30'), `${booking.event_time}`);

      // The `?? null` path both routes take when no time is supplied.
      const [noTime] = await tx`
        INSERT INTO catering_events (customer_id, event_type, event_date, event_time, guest_count, venue_address)
        VALUES (${cust.id}, 'lunch', ${'2026-08-03'}::date, ${null}::time, ${10}, '5 Test Road, Lagos')
        RETURNING event_time`;
      check('a null event_time is still allowed', noTime.event_time === null, `${noTime.event_time}`);

      // ── What the conversion is actually for ────────────────────────────────
      await expectReject(tx, 'an invalid time is now rejected by the column', sp => sp`
        INSERT INTO catering_events (customer_id, event_type, event_date, event_time, guest_count, venue_address)
        VALUES (${cust.id}, 'lunch', ${'2026-08-04'}::date, ${'sometime after lunch'}, ${10}, '6 Test Road, Lagos')`);

      // Chronological ordering is now the column's job, not the caller's.
      await tx`INSERT INTO catering_events (customer_id, event_type, event_date, event_time, guest_count, venue_address)
               VALUES (${cust.id}, 'lunch', ${'2026-08-05'}::date, ${'10:00'}::time, ${10}, '7 Test Road, Lagos')`;
      const ordered = await tx`
        SELECT event_time FROM catering_events
        WHERE customer_id = ${cust.id} AND event_time IS NOT NULL ORDER BY event_time ASC`;
      check('times sort chronologically',
        String(ordered[0].event_time).startsWith('09:00') && String(ordered[1].event_time).startsWith('10:00'),
        ordered.map(o => String(o.event_time)).join(' < '));

      throw new Error('__ROLLBACK__');
    });
  } catch (e) {
    if (e.message !== '__ROLLBACK__') {
      console.error('\ntest error:', e.message);
      results.push({ name: 'transaction completed', ok: 'FAIL', detail: e.message.split('\n')[0] });
    }
  }

  const [{ n }] = await sql`SELECT COUNT(*)::int n FROM users WHERE phone = ${PHONE}`;
  check('rolled back — no seed rows committed', n === 0, `found ${n}`);
  const [{ d }] = await sql`
    SELECT data_type d FROM information_schema.columns
    WHERE table_schema='public' AND table_name='catering_events' AND column_name='event_time'`;
  console.log(`\n(outside the transaction catering_events.event_time is still: ${d})`);

  await sql.end();

  const pad = (s, w) => String(s).padEnd(w);
  console.log('\n──── EVENT TIME TYPE TEST (migration 063) ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 50)} ${String(r.detail).slice(0, 52)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error('fatal:', e); process.exitCode = 1; });
