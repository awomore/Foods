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
// Under `railway run --service Postgres` the injected DATABASE_URL points at
// postgres.railway.internal, which resolves only inside Railway's network.
// DATABASE_PUBLIC_URL is the reachable one — swap it in before ../supabase/db
// reads the variable, so this audit can be pointed at production directly.
if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
const fs = require('fs');
const path = require('path');
const { sql } = require('../supabase/db');

// Every directory whose code runs SQL against the live db at request time.
// middleware/ and workers/ were missing until 2026-09-08: middleware/auth.js
// runs on nearly every authenticated request, so a table only it referenced
// would have been invisible to this audit. scripts/ is deliberately excluded —
// those are tools and tests, not the running service.
const CODE_DIRS  = ['routes', 'services', 'payments', 'middleware', 'workers'];
const CODE_FILES = ['server.js'];
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

// Pull out whole sql`…` templates, tracking ${…} depth so a nested template
// does not end the outer one.
//
// This was `src.match(/sql`[\s\S]*?`/g)`, which is non-greedy and therefore
// stops at the FIRST backtick after sql`. Where a query interpolates a
// conditional fragment — `${hasGeo ? sql`…` : sql`0`}`, the house style for
// optional SQL — that first backtick opens the *nested* template, so the block
// ended partway down the SELECT list and every FROM and JOIN below it went
// unread. routes/feed.js is exactly that shape: the audit could not see
// `LEFT JOIN creator_debut_impressions`, a table in no migration and no
// database, and the home feed 500'd for every user for eleven weeks with this
// check reporting clean. 22 of 1072 templates nest this way.
function sqlTemplates(src) {
  const out = [];
  const open = /\bsql`/g;
  let m;
  while ((m = open.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;               // ${ } nesting
    const start = i;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
      if (c === '}' && depth > 0) { depth--; i++; continue; }
      if (c === '`') {
        if (depth === 0) break;  // closes this template
        i = skipNested(src, i) + 1;
        continue;
      }
      i++;
    }
    out.push(src.slice(start, i));
    open.lastIndex = i;          // don't rescan the nested templates
  }
  return out;
}

// Given the index of a backtick that opens a template inside an interpolation,
// return the index of its matching close.
function skipNested(src, i) {
  let j = i + 1;
  let depth = 0;
  while (j < src.length) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
    if (src[j] === '}' && depth > 0) { depth--; j++; continue; }
    if (src[j] === '`' && depth === 0) return j;
    j++;
  }
  return src.length;
}

// Blank out ${…} so `${sql(table)}` can't masquerade as a table name. Brace
// balancing matters: the old /\$\{[^}]*\}/ stopped at the first inner `}`, so
// an interpolation containing an object literal leaked its tail back into the
// scanned text.
function stripInterpolations(block) {
  let out = '';
  let i = 0;
  while (i < block.length) {
    if (block[i] === '$' && block[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < block.length && depth > 0) {
        if (block[i] === '{') depth++;
        else if (block[i] === '}') depth--;
        i++;
      }
      out += ' ? ';
      continue;
    }
    out += block[i++];
  }
  return out;
}

// Scans only inside sql`…` template literals. Scanning whole files picks up
// English prose from comments ("FROM the cook's…" → table "the").
function collectRefs() {
  const refs = new Map(); // table -> Set(file)

  const scanFile = p => {
    const src = fs.readFileSync(p, 'utf8');
    const file = p.split(path.sep).join('/');
    for (const block of sqlTemplates(src)) {
      const cleaned = stripSqlComments(stripInterpolations(block));
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
  };

  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith('.js')) continue;
      scanFile(p);
    }
  };

  for (const d of CODE_DIRS) if (fs.existsSync(d)) walk(d);
  for (const f of CODE_FILES) if (fs.existsSync(f)) scanFile(f);
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

const report = async () => {
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
  // exitCode, not exit(): exit() discards buffered stdout when it is a pipe,
  // which swallows the whole report under `railway run`.
  process.exitCode = codeMissing.length ? 1 : 0;
};

// The parser is exported so schema-drift-check-test.js can exercise it on
// fixtures. Run directly to produce the report; requiring must not query.
module.exports = { sqlTemplates, stripInterpolations, collectRefs, declaredTables };

if (require.main === module) {
  report().catch(e => { console.error(e); process.exitCode = 1; });
}
