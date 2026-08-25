// Repairs the duplicate accounts the old exact-string phone lookup created.
//
// 066 stopped NEW orphans, but it cannot recover old ones: if the duplicate is
// stored in exactly the spelling the app sends, exact match still wins and the
// original account stays unreachable. Clearing the empty duplicate is what makes
// the original resolve again.
//
// DRY RUN BY DEFAULT. Nothing is written without --apply.
//
//   node scripts/phone-repair.js                 report what it would do
//   node scripts/phone-repair.js --apply         do it, after writing a backup
//   DATABASE_URL="<railway url>" node scripts/phone-repair.js    against production
//
// Why this is written so defensively: deleting a users row CASCADES into 54
// tables — wallet balances, reviews, follows, cook profiles, disputes. Two things
// stand between this script and that. First, it refuses to touch any row with a
// dependent anywhere, except the incidental tables listed below. Second, the
// schema itself: orders.customer_id is RESTRICT and twelve more FKs are NO
// ACTION, so Postgres refuses the delete outright if real activity exists. The
// script checks first and the database checks again.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sql } = require('../supabase/db');

const APPLY = process.argv.includes('--apply');
const host = (process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0] || 'unknown';

// Rows created by the mere act of logging in or opening the app. A duplicate
// carrying only these is an empty shell: nothing here is anything a person would
// miss, and most of it is telemetry the schema already nulls rather than cascades.
// Anything NOT on this list makes a row substantive and the group manual.
const INCIDENTAL = new Set([
  'push_tokens',
  'analytics_events',
  'search_history',
  'user_interaction_signals',
  'video_views',
  'social_conversions',
]);

/** Every table with a FK to users(id), read from the catalog so it cannot go stale. */
async function referencingTables() {
  const rows = await sql`
    SELECT tc.table_name, kcu.column_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND ccu.table_name = 'users' AND ccu.column_name = 'id'
     ORDER BY tc.table_name, kcu.column_name`;
  return rows.map(r => ({ table: r.table_name, column: r.column_name, rule: r.delete_rule }));
}

/** What every collision group looks like, with each row's dependents counted. */
async function collisionGroups(refs) {
  const rows = await sql`
    WITH keyed AS (
      SELECT id, phone, role, full_name, email, created_at,
             RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) AS key
        FROM users
       WHERE phone IS NOT NULL
         AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') <> ''
    )
    SELECT * FROM keyed k
     WHERE k.key IN (SELECT key FROM keyed GROUP BY key HAVING COUNT(*) > 1)
     ORDER BY k.key, k.created_at ASC`;

  const byId = new Map(rows.map(r => [r.id, r]));
  for (const row of rows) row.deps = {};
  const candidateIds = rows.map(r => r.id);

  for (const ref of refs) {
    const counts = await sql.unsafe(
      `SELECT ${ref.column} AS uid, COUNT(*)::int AS n FROM ${ref.table}
        WHERE ${ref.column} = ANY($1::uuid[]) GROUP BY ${ref.column}`, [candidateIds]);
    for (const c of counts) {
      const row = byId.get(c.uid);
      if (row) row.deps[`${ref.table}.${ref.column}`] = { n: c.n, rule: ref.rule };
    }
  }

  for (const row of rows) {
    row.substantive = Object.entries(row.deps)
      .filter(([k]) => !INCIDENTAL.has(k.split('.')[0]))
      .map(([k, v]) => `${k}=${v.n}`);
    row.incidental = Object.entries(row.deps)
      .filter(([k]) => INCIDENTAL.has(k.split('.')[0]))
      .map(([k, v]) => `${k}=${v.n}`);
    row.isShell = row.substantive.length === 0;
  }

  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.key)) groups.set(row.key, []);
    groups.get(row.key).push(row);
  }
  return groups;
}

/**
 * What to do with one group. Only two shapes are safe to act on automatically;
 * everything else is a decision about whose history survives, and this script
 * does not make those.
 */
function verdict(rows) {
  const keepers = rows.filter(r => !r.isShell);
  const shells  = rows.filter(r => r.isShell);

  if (keepers.length === 1 && shells.length >= 1) {
    return { action: 'repair', keep: keepers[0], drop: shells,
             why: 'one real account, the rest are empty shells' };
  }
  if (keepers.length === 0 && shells.length >= 2) {
    // All empty. Keep the oldest, which is the row the lookup already prefers.
    return { action: 'repair', keep: shells[0], drop: shells.slice(1),
             why: 'every row is empty; keeping the oldest, which is the one login resolves to' };
  }
  if (keepers.length >= 2) {
    return { action: 'manual', keep: null, drop: [],
             why: `${keepers.length} rows carry real activity — pick the survivor by hand` };
  }
  return { action: 'manual', keep: null, drop: [], why: 'unrecognised shape' };
}

function describe(row, tag) {
  const when = new Date(row.created_at).toLocaleDateString('en-NG');
  const bits = [
    `  ${tag}  ${String(row.phone).padEnd(16)} ${String(row.role || '-').padEnd(9)}`,
    `${String(row.full_name || '(no name)').slice(0, 24).padEnd(26)} ${when}`,
  ].join(' ');
  const lines = [bits, `        ${row.id}`];
  if (row.substantive.length) lines.push(`        carries: ${row.substantive.join(', ')}`);
  if (row.incidental.length)  lines.push(`        incidental: ${row.incidental.join(', ')}`);
  if (!row.substantive.length && !row.incidental.length) lines.push('        carries: nothing');
  return lines.join('\n');
}

(async () => {
  console.log(`\nDatabase: ${host}`);
  console.log(APPLY ? 'Mode:     APPLY — this will delete rows\n'
                    : 'Mode:     dry run — nothing will be written\n');

  const refs = await referencingTables();
  console.log(`Checking ${refs.length} tables that reference users(id).\n`);

  const groups = await collisionGroups(refs);
  if (!groups.size) {
    console.log('No collisions: every account has a distinct national number.\n');
    await sql.end();
    return;
  }

  const plan = [];
  for (const [key, rows] of groups) {
    const v = verdict(rows);
    console.log(`── ...${key} ${'─'.repeat(46)}`);
    console.log(`   ${v.action === 'repair' ? 'REPAIRABLE' : 'MANUAL'} — ${v.why}`);
    for (const row of rows) {
      const tag = row === v.keep ? 'KEEP  ' : (v.drop.includes(row) ? 'DELETE' : '      ');
      console.log(describe(row, tag));
    }
    console.log();
    if (v.action === 'repair') plan.push({ key, ...v });
  }

  const dropCount = plan.reduce((n, p) => n + p.drop.length, 0);
  console.log(`${groups.size} group(s): ${plan.length} repairable, ${groups.size - plan.length} manual.`);
  console.log(`${dropCount} row(s) would be deleted.\n`);

  if (!plan.length) {
    console.log('Nothing to do automatically.\n');
    await sql.end();
    return;
  }

  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to perform the deletions above.\n');
    await sql.end();
    return;
  }

  // A backup of every row about to disappear, written BEFORE anything is deleted.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `phone-repair-backup-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(
    plan.map(p => ({ key: p.key, keep: p.keep.id, dropped: p.drop })), null, 2));
  console.log(`Backup written: ${backupPath}\n`);

  let deleted = 0;
  for (const p of plan) {
    for (const row of p.drop) {
      try {
        await sql`DELETE FROM users WHERE id = ${row.id}`;
        deleted++;
        console.log(`  deleted ${row.phone}  ${row.id}`);
      } catch (e) {
        // RESTRICT / NO ACTION firing here means the row was not as empty as it
        // looked. That is the database doing its job — leave it for a human.
        console.log(`  REFUSED ${row.phone}  ${row.id}\n    ${e.message.slice(0, 140)}`);
      }
    }
    const left = await sql`
      SELECT COUNT(*)::int AS n FROM users
       WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = ${p.key}`;
    console.log(`  ...${p.key} now resolves to ${left[0].n} row(s)\n`);
  }

  console.log(`Done: ${deleted} row(s) deleted. Backup: ${backupPath}\n`);
  await sql.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
