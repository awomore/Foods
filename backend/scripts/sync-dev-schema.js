// Rebuilds the development database's schema to match production's, exactly.
//
// WHY THIS EXISTS
// The Neon db that backend/.env points at is not a copy of production — it is a
// different schema that drifted in both directions. It has hand-made tables no
// migration declares, and it is *missing* columns production has had since 001
// (meal_subscriptions.customer_id is the one that cost a day: gifting.js supplies
// no value for it, so POST /gifting/subscriptions passed locally and 500'd in
// production). Replaying migrations onto it does not fix that — 024/044/046 are
// not re-runnable, so a full replay fails partway.
//
// So the schema is copied from the live production database instead of derived
// from the migration files. Production is the thing we actually care about being
// right against.
//
// SCHEMA ONLY. No application rows are copied — the dev db comes out empty. The
// two migration ledgers (_migrations, db_migrations) ARE copied, because without
// them migrate.js would try to replay everything on the next run.
//
// USAGE — dry run first (prints the plan, writes nothing):
//   RW="$APPDATA/npm/node_modules/@railway/cli/bin/railway.exe"
//   cd backend && "$RW" run --service Postgres node scripts/sync-dev-schema.js
// Then, to actually rebuild the dev database:
//   cd backend && "$RW" run --service Postgres node scripts/sync-dev-schema.js --apply
//
// Re-run this after every deploy that adds a migration. That is the whole point:
// the drift comes back otherwise, and "works locally" stops being evidence again.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const { isProductionHost } = require('./lib/assert-not-production');

const APPLY = process.argv.includes('--apply');

// ── Endpoints ───────────────────────────────────────────────────────────────
// Source is production. Under `railway run` the injected DATABASE_URL points at
// postgres.railway.internal, which only resolves inside Railway's network, so
// DATABASE_PUBLIC_URL is the reachable one.
const SOURCE_URL = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

// Target is the dev db. It CANNOT come from process.env.DATABASE_URL: under
// `railway run` that variable has been overwritten with production's. Read the
// .env file off disk so the dev URL survives being run inside railway's env.
const envPath = path.join(__dirname, '..', '.env');
const fileEnv = fs.existsSync(envPath)
  ? require('dotenv').parse(fs.readFileSync(envPath))
  : {};
const TARGET_URL = process.env.DEV_DATABASE_URL || fileEnv.DATABASE_URL;

// Sets the exit code and reports false; every caller returns on false. Not
// process.exit() — that discards buffered stdout under a pipe, which is how a
// failing script ends up looking like a silent one under `railway run`.
function fail(msg) {
  console.error(`\n${msg}\n`);
  process.exitCode = 1;
  return false;
}

// ── DDL generation ──────────────────────────────────────────────────────────
const q = id => `"${id.replace(/"/g, '""')}"`;

async function introspect(sql) {
  const extensions = await sql`
    SELECT extname, extversion FROM pg_extension
    WHERE extname <> 'plpgsql' ORDER BY extname`;

  const sequences = await sql`
    SELECT c.relname, s.seqstart, s.seqincrement, s.seqmin, s.seqmax, s.seqcache, s.seqcycle
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_sequence s ON s.seqrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'S'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    ORDER BY c.relname`;

  // A serial column's sequence is "owned by" it; without re-establishing that,
  // dropping the table would orphan the sequence.
  const seqOwners = await sql`
    SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
    FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    JOIN pg_namespace n ON n.oid = s.relnamespace
    WHERE s.relkind = 'S' AND n.nspname = 'public'`;

  const columns = await sql`
    SELECT c.relname AS tbl, a.attname AS col, a.attnum,
           format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS notnull,
           pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    ORDER BY c.relname, a.attnum`;

  // contype 'n' (NOT NULL) is deliberately excluded: PG17 records those in
  // pg_constraint, but they are already carried by attnotnull on the column.
  // Ordering matters — p and u build the indexes that f then references.
  const constraints = await sql`
    SELECT c.relname AS tbl, con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype IN ('p', 'u', 'c', 'f')
    ORDER BY array_position(ARRAY['p','u','c','f']::"char"[], con.contype), c.relname, con.conname`;

  // Constraint-backed indexes arrive with their constraint; creating them again
  // by name would collide.
  const indexes = await sql`
    SELECT i.relname AS name, pg_get_indexdef(x.indexrelid) AS def
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class c ON c.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = i.relnamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = x.indexrelid)
    ORDER BY i.relname`;

  // deptype 'e' excludes everything pg_trgm and uuid-ossp brought with them —
  // CREATE EXTENSION recreates those, and pg_get_functiondef on a C function
  // emits a definition pointing at a shared object path.
  const functions = await sql`
    SELECT p.oid::regprocedure::text AS sig, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    ORDER BY p.oid::regprocedure::text`;

  const triggers = await sql`
    SELECT t.tgname, c.relname AS tbl, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname`;

  const views = await sql`
    SELECT c.relname AS name, c.relkind, pg_get_viewdef(c.oid, true) AS def
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    ORDER BY c.relname`;

  return { extensions, sequences, seqOwners, columns, constraints, indexes, functions, triggers, views };
}

function buildTableDDL(columns) {
  const byTable = new Map();
  for (const c of columns) {
    if (!byTable.has(c.tbl)) byTable.set(c.tbl, []);
    byTable.get(c.tbl).push(c);
  }
  const stmts = [];
  for (const [tbl, cols] of [...byTable].sort(([a], [b]) => a.localeCompare(b))) {
    const defs = cols.map(c => {
      let s = `  ${q(c.col)} ${c.type}`;
      if (c.default_expr) s += ` DEFAULT ${c.default_expr}`;
      if (c.notnull) s += ' NOT NULL';
      return s;
    });
    stmts.push(`CREATE TABLE ${q(tbl)} (\n${defs.join(',\n')}\n)`);
  }
  return { stmts, tableCount: byTable.size };
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  if (!SOURCE_URL) {
    return fail('No source URL. Run this under `railway run --service Postgres` so\n' +
                'DATABASE_PUBLIC_URL is set, or pass SOURCE_DATABASE_URL explicitly.');
  }
  if (!TARGET_URL) {
    return fail('No target URL. Set DEV_DATABASE_URL, or put the dev database URL in\n' +
                'backend/.env as DATABASE_URL.');
  }

  const srcHost = new URL(SOURCE_URL).hostname;
  const tgtHost = new URL(TARGET_URL).hostname;

  // The whole script begins with DROP SCHEMA public CASCADE. Getting these two
  // the wrong way round would destroy production, so this check is not
  // overridable — unlike the write-guard, there is no ALLOW_ flag here.
  if (isProductionHost(tgtHost)) {
    return fail(`REFUSING TO RUN: the target (${tgtHost}) is a production host.\n` +
                'This script drops and recreates the target schema. It must never point at production.');
  }
  if (srcHost === tgtHost) {
    return fail(`REFUSING TO RUN: source and target are the same host (${srcHost}).`);
  }

  // 'prefer', not 'require': Railway's proxy is TCP passthrough and may not offer
  // TLS, while Neon demands it. 'prefer' satisfies both.
  const src = postgres(SOURCE_URL, { ssl: 'prefer', max: 2, connect_timeout: 20 });
  const tgt = postgres(TARGET_URL, { ssl: 'prefer', max: 2, connect_timeout: 20 });

  try {
    const srcDb = (await src`SELECT current_database() d`)[0].d;
    const tgtDb = (await tgt`SELECT current_database() d`)[0].d;
    console.log(`source (production) : ${srcDb} @ ${srcHost}`);
    console.log(`target (dev)        : ${tgtDb} @ ${tgtHost}`);
    console.log(`mode                : ${APPLY ? 'APPLY — the target schema will be dropped' : 'DRY RUN — nothing will be written'}\n`);

    const s = await introspect(src);
    const { stmts: tableStmts, tableCount } = buildTableDDL(s.columns);

    const byType = t => s.constraints.filter(c => c.contype === t).length;
    console.log('Production schema to be reproduced:');
    console.log(`  extensions   ${s.extensions.length}   (${s.extensions.map(e => e.extname).join(', ')})`);
    console.log(`  sequences    ${s.sequences.length}`);
    console.log(`  tables       ${tableCount}   (${s.columns.length} columns)`);
    console.log(`  constraints  ${s.constraints.length}   (pk ${byType('p')}, unique ${byType('u')}, check ${byType('c')}, fk ${byType('f')})`);
    console.log(`  indexes      ${s.indexes.length}   (non-constraint)`);
    console.log(`  functions    ${s.functions.length}`);
    console.log(`  triggers     ${s.triggers.length}`);
    console.log(`  views        ${s.views.length}`);

    if (!APPLY) {
      console.log('\nDry run — nothing written. Re-run with --apply to rebuild the dev schema.');
      await src.end(); await tgt.end();
      return;
    }

    // Everything below runs in ONE transaction. Postgres DDL is transactional,
    // so a failure anywhere leaves the dev database exactly as it was rather
    // than half-rebuilt.
    const deferredFunctions = [];
    await tgt.begin(async t => {
      await t.unsafe('DROP SCHEMA public CASCADE');
      await t.unsafe('CREATE SCHEMA public');

      for (const e of s.extensions) {
        await t.unsafe(`CREATE EXTENSION IF NOT EXISTS ${q(e.extname)} WITH SCHEMA public`);
      }

      for (const seq of s.sequences) {
        await t.unsafe(
          `CREATE SEQUENCE ${q(seq.relname)} INCREMENT ${seq.seqincrement} ` +
          `MINVALUE ${seq.seqmin} MAXVALUE ${seq.seqmax} START ${seq.seqstart} ` +
          `CACHE ${seq.seqcache}${seq.seqcycle ? ' CYCLE' : ''}`);
      }

      for (const stmt of tableStmts) await t.unsafe(stmt);

      for (const o of s.seqOwners) {
        await t.unsafe(`ALTER SEQUENCE ${q(o.seq)} OWNED BY ${q(o.tbl)}.${q(o.col)}`);
      }

      // plpgsql bodies are not parsed at creation, so these almost always apply
      // before their tables exist. A SQL-language function with BEGIN ATOMIC
      // would not — those get retried after the tables are in place.
      for (const f of s.functions) {
        try { await t.unsafe(f.def); } catch { deferredFunctions.push(f); }
      }

      for (const c of s.constraints) {
        await t.unsafe(`ALTER TABLE ${q(c.tbl)} ADD CONSTRAINT ${q(c.conname)} ${c.def}`);
      }

      for (const f of deferredFunctions) await t.unsafe(f.def);

      for (const i of s.indexes) await t.unsafe(i.def);

      for (const tr of s.triggers) await t.unsafe(tr.def);

      // Views can depend on other views, and pg_class order is alphabetical, not
      // topological. Retry until a full pass adds nothing new.
      let pending = [...s.views];
      while (pending.length) {
        const failed = [];
        for (const v of pending) {
          const kind = v.relkind === 'm' ? 'MATERIALIZED VIEW' : 'VIEW';
          try { await t.unsafe(`CREATE ${kind} ${q(v.name)} AS ${v.def}`); }
          catch (e) { failed.push(v); v._err = e.message; }
        }
        if (failed.length === pending.length) {
          throw new Error(`Views could not be ordered: ${failed.map(v => `${v.name} (${v._err})`).join('; ')}`);
        }
        pending = failed;
      }

      // Copy the migration ledgers only — without them migrate.js would replay
      // every migration onto the fresh schema on its next run.
      for (const ledger of ['_migrations', 'db_migrations']) {
        const exists = s.columns.some(c => c.tbl === ledger);
        if (!exists) continue;
        const rows = await src.unsafe(`SELECT * FROM ${q(ledger)}`);
        if (rows.length) {
          const cols = Object.keys(rows[0]);
          const placeholders = rows
            .map((_, ri) => `(${cols.map((__, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`)
            .join(', ');
          const values = rows.flatMap(r => cols.map(c => r[c]));
          await t.unsafe(
            `INSERT INTO ${q(ledger)} (${cols.map(q).join(', ')}) VALUES ${placeholders}`,
            values);
        }
        console.log(`  ledger ${ledger}: ${rows.length} rows copied`);
      }

      // Serial ledgers need their sequence moved past the copied rows or the
      // next insert collides on the primary key. is_called is false when the
      // table is empty, so the sequence still hands out 1 rather than skipping it.
      for (const o of s.seqOwners) {
        await t.unsafe(
          `SELECT setval('${o.seq}',` +
          ` COALESCE((SELECT MAX(${q(o.col)}) FROM ${q(o.tbl)}), 1),` +
          ` (SELECT MAX(${q(o.col)}) FROM ${q(o.tbl)}) IS NOT NULL)`);
      }
    });

    if (deferredFunctions.length) {
      console.log(`  ${deferredFunctions.length} function(s) needed their tables first (retried, applied)`);
    }

    // ── Verify against the source rather than trusting the transaction ──────
    const count = async (conn, q2) => Number((await conn.unsafe(q2))[0].n);
    const checks = [
      ['tables',      `SELECT count(*) n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='r'`],
      ['columns',     `SELECT count(*) n FROM information_schema.columns WHERE table_schema='public'`],
      ['indexes',     `SELECT count(*) n FROM pg_indexes WHERE schemaname='public'`],
      ['constraints', `SELECT count(*) n FROM pg_constraint c JOIN pg_namespace ns ON ns.oid=c.connamespace WHERE ns.nspname='public' AND c.contype IN ('p','u','c','f')`],
      ['functions',   `SELECT count(*) n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')`],
      ['views',       `SELECT count(*) n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind IN ('v','m')`],
    ];

    console.log('\nVerification — production vs dev:');
    let mismatches = 0;
    for (const [label, query] of checks) {
      const a = await count(src, query);
      const b = await count(tgt, query);
      const ok = a === b;
      if (!ok) mismatches++;
      console.log(`  ${ok ? 'OK  ' : 'DIFF'} ${label.padEnd(12)} production ${String(a).padStart(5)}   dev ${String(b).padStart(5)}`);
    }

    if (mismatches) {
      console.error(`\n${mismatches} category/categories differ. The dev schema is NOT a faithful copy.`);
      process.exitCode = 1;
    } else {
      console.log('\nDev schema now matches production. Re-run after every migration.');
    }

    await src.end(); await tgt.end();
  } catch (e) {
    if (e.message !== '__ABORT__') {
      console.error('\nFAILED:', e.message);
      console.error('The dev database was left unchanged (the rebuild runs in one transaction).');
      process.exitCode = 1;
    }
    await src.end({ timeout: 5 }); await tgt.end({ timeout: 5 });
  }
})();
