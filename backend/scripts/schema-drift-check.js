// Reports where the live database disagrees with what the backend code needs.
//
// Exists because both known databases drift from the migrations, in opposite
// directions: the Neon db in backend/.env has hand-made tables that no migration
// declares, while the Railway (production) db has only what the migrations
// create. `_migrations` claims everything is applied in both, so migrate.js will
// never reconcile either one. See the two-databases note in project memory.
//
// Read-only. Point it at whichever db you want to judge:
//   cd backend; DATABASE_URL=<url> node scripts/schema-drift-check.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sql } = require('../supabase/db');

const CODE_DIRS = ['routes', 'services', 'payments'];
// Words that legitimately follow FROM/JOIN/UPDATE without being tables.
const NOT_TABLES = new Set([
  'select', 'dual', 'set', 'values', 'only', 'lateral', 'unnest', 'generate_series',
  'jsonb_array_elements', 'jsonb_each', 'json_array_elements', 'sql',
]);

// Comments and string literals inside SQL are prose, and prose contains phrases
// that read as table references: "CREATE TABLE rather than ADD CONSTRAINT" in a
// comment, or 'Points earned from order' in a literal.
const stripSqlComments = s => s.replace(/--[^\n]*/g, ' ').replace(/'[^']*'/g, " '' ");

// A name followed by `(` is a function call — age(), compute_repeat_rate() —
// and one or two characters is a CTE/table alias, not a table.
const looksLikeTable = (name, rest) => name.length > 2 && !/^\s*\(/.test(rest);

// Scans only inside sql`…` template literals. Scanning whole files picks up
// English prose from comments ("FROM the cook's…" → table "the").
function collectRefs() {
  const refs = new Map(); // table -> Set(file)
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith('.js')) continue;

      const src = fs.readFileSync(p, 'utf8');
      const file = p.split(path.sep).join('/');
      const blocks = src.match(/sql`[\s\S]*?`/g) ?? [];
      for (const block of blocks) {
        // Strip interpolations so `${sql(table)}` can't masquerade as a name.
        const cleaned = stripSqlComments(block.replace(/\$\{[^}]*\}/g, ' ? '));
        const re = /(?:FROM|INSERT\s+INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/gi;
        let m;
        while ((m = re.exec(cleaned))) {
          const t = m[1].toLowerCase();
          if (NOT_TABLES.has(t)) continue;
          if (!looksLikeTable(t, cleaned.slice(m.index + m[0].length))) continue;
          if (!refs.has(t)) refs.set(t, new Set());
          refs.get(t).add(file);
        }
      }
    }
  };
  for (const d of CODE_DIRS) if (fs.existsSync(d)) walk(d);
  return refs;
}

function declaredTables() {
  const declared = new Map(); // table -> migration file
  const files = fs.readdirSync('migrations')
    .filter(f => f.endsWith('.sql') && !f.includes('.down.'))
    .sort();
  for (const f of files) {
    const src = stripSqlComments(fs.readFileSync(path.join('migrations', f), 'utf8'));
    const re = /CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let m;
    while ((m = re.exec(src))) if (!declared.has(m[1])) declared.set(m[1], f);
  }
  return declared;
}

(async () => {
  const host = new URL(process.env.DATABASE_URL).hostname;
  const refs = collectRefs();
  const declared = declaredTables();

  const present = new Set((await sql`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  `).map(r => r.table_name));

  console.log(`\ndb host: ${host}`);
  console.log(`code references ${refs.size} tables | migrations declare ${declared.size} | db has ${present.size}\n`);

  const codeMissing = [...refs.keys()].filter(t => !present.has(t)).sort();
  console.log(`A. TABLES THE CODE USES BUT THIS DB LACKS (${codeMissing.length}) — these endpoints 500:`);
  for (const t of codeMissing) {
    const where = [...refs.get(t)].slice(0, 3).join(', ');
    console.log(`   ${t.padEnd(30)} ${where}`);
  }

  const undeclared = codeMissing.filter(t => !declared.has(t));
  console.log(`\nB. …of those, declared by NO migration (${undeclared.length}) — schema exists only by hand, if at all:`);
  console.log(`   ${undeclared.join(', ') || '(none)'}`);

  const declaredMissing = [...declared].filter(([t]) => !present.has(t));
  console.log(`\nC. DECLARED BY A MIGRATION BUT ABSENT HERE (${declaredMissing.length}) — migration never really ran:`);
  for (const [t, f] of declaredMissing) console.log(`   ${t.padEnd(30)} ${f}`);

  const [mig] = await sql`SELECT count(*)::int AS n, max(filename) AS last FROM _migrations`;
  console.log(`\n_migrations claims ${mig.n} applied, latest ${mig.last} — compare against the lists above.`);

  await sql.end();
  process.exit(codeMissing.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
