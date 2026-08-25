// Proves phone-repair.js against the DEV database on seeded collisions.
//
// This script deletes users rows in production, and deleting a users row cascades
// into 54 tables. So the things worth proving are not that it deletes — it is that
// it deletes ONLY the empty duplicate, refuses anything ambiguous, and leaves the
// surviving account's data untouched.
require('dotenv').config();
const { execFileSync } = require('child_process');
const path = require('path');
const { sql } = require('../supabase/db');

const SCRIPT = path.join(__dirname, 'phone-repair.js');

// One group per shape the script has to recognise.
const A_REAL  = '09099000021', A_SHELL = '2349099000021'; // real + empty shell
const B_ONE   = '09099000022', B_TWO   = '2349099000022'; // both real
const C_OLD   = '09099000023', C_NEW   = '2349099000023'; // both empty
const ALL = [A_REAL, A_SHELL, B_ONE, B_TWO, C_OLD, C_NEW];

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const ids = {};

async function wipe() {
  await sql`DELETE FROM users WHERE phone = ANY(${ALL}::text[])`;
}

async function mkUser(phone, { name, minutesAgo = 0 }) {
  const [u] = await sql`
    INSERT INTO users (full_name, phone, role, is_active, created_at)
    VALUES (${name}, ${phone}, 'customer', true, NOW() - (${minutesAgo} * INTERVAL '1 minute'))
    RETURNING id`;
  return u.id;
}

// customer_profiles is NOT on the incidental list, so it makes a row substantive.
const makeReal = id => sql`INSERT INTO customer_profiles (user_id) VALUES (${id})
                           ON CONFLICT (user_id) DO NOTHING`;
// push_tokens IS incidental — a row carrying only this must still count as a shell.
const makeIncidental = id => sql`INSERT INTO push_tokens (user_id, token)
                                 VALUES (${id}, ${'e2e-repair-' + id}) ON CONFLICT DO NOTHING`;

const run = (...args) => execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
const exists = async id => (await sql`SELECT 1 FROM users WHERE id = ${id}`).length > 0;

(async () => {
  try {
    await wipe();

    ids.aReal  = await mkUser(A_REAL,  { name: 'E2E Repair A Real',  minutesAgo: 60 });
    ids.aShell = await mkUser(A_SHELL, { name: 'E2E Repair A Shell', minutesAgo: 5 });
    await makeReal(ids.aReal);
    await makeIncidental(ids.aShell);

    ids.bOne = await mkUser(B_ONE, { name: 'E2E Repair B One', minutesAgo: 60 });
    ids.bTwo = await mkUser(B_TWO, { name: 'E2E Repair B Two', minutesAgo: 5 });
    await makeReal(ids.bOne);
    await makeReal(ids.bTwo);

    ids.cOld = await mkUser(C_OLD, { name: 'E2E Repair C Old', minutesAgo: 60 });
    ids.cNew = await mkUser(C_NEW, { name: 'E2E Repair C New', minutesAgo: 5 });

    // ── dry run ────────────────────────────────────────────────────────────
    const dry = run();

    check('dry run says it is a dry run', /Mode:\s+dry run/.test(dry));
    check('group A is repairable',
      /\.\.\.9099000021[\s\S]{0,80}REPAIRABLE/.test(dry));
    check('group B is left to a human',
      /\.\.\.9099000022[\s\S]{0,120}MANUAL/.test(dry));
    check('group C is repairable',
      /\.\.\.9099000023[\s\S]{0,80}REPAIRABLE/.test(dry));
    check('a row carrying only push_tokens still counts as a shell',
      /DELETE\s+2349099000021/.test(dry), 'A shell marked for deletion');
    check('the real account is marked KEEP',
      /KEEP\s+09099000021/.test(dry));
    check('the oldest of two empty rows is the one kept',
      /KEEP\s+09099000023/.test(dry) && /DELETE\s+2349099000023/.test(dry));
    check('dry run changed nothing',
      (await exists(ids.aShell)) && (await exists(ids.cNew)));

    // ── apply ──────────────────────────────────────────────────────────────
    const applied = run('--apply');

    check('apply wrote a backup before deleting',
      /Backup written:/.test(applied) &&
      applied.indexOf('Backup written:') < applied.indexOf('deleted '));
    check('A: the empty shell is gone',        !(await exists(ids.aShell)));
    check('A: the real account survives',        await exists(ids.aReal));
    check('A: its profile row is untouched',
      (await sql`SELECT 1 FROM customer_profiles WHERE user_id = ${ids.aReal}`).length === 1);
    check('B: both real accounts survive',
      (await exists(ids.bOne)) && (await exists(ids.bTwo)), 'neither deleted');
    check('C: the newer empty row is gone',   !(await exists(ids.cNew)));
    check('C: the older empty row survives',    await exists(ids.cOld));

    // The point of the exercise: the number now resolves to exactly one account.
    const [left] = await sql`
      SELECT COUNT(*)::int AS n FROM users
       WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = '9099000021'`;
    check('A: the number now resolves to a single account', left.n === 1, `${left.n} row(s)`);

    // And a second pass has nothing left to do beyond the manual group.
    const again = run();
    check('a second run leaves only the manual group',
      /1 repairable/.test(again) === false && /0 repairable/.test(again),
      (again.match(/\d+ group\(s\): .*/) || [''])[0]);

  } finally {
    await wipe();
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(58)} ${String(r.detail).slice(0, 60)}`);
  }
  console.log(`\n${results.length} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });
