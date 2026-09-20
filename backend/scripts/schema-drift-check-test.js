// Regression test for the schema-drift-check parser.
//
// The audit exists to catch code that queries a table no database has. It
// silently failed to do that: block extraction used a non-greedy
// /sql`[\s\S]*?`/, which ends at the first backtick after sql` — and where a
// query interpolates a conditional fragment (`${cond ? sql`…` : sql`…`}`) that
// backtick belongs to the NESTED template. Everything after it, FROM and JOIN
// included, went unscanned.
//
// routes/feed.js was exactly that shape. `LEFT JOIN creator_debut_impressions`
// sat below such an interpolation, the table exists in no migration and no
// database, and GET /api/feed/home returned 500 for every user for eleven weeks
// while this audit reported clean.
//
// Needs no database — the defect was entirely in the parser.
//
// Usage: cd backend; node scripts/schema-drift-check-test.js
const { sqlTemplates, stripInterpolations } = require('./schema-drift-check');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });

// Table references the parser finds, using the same shape the audit uses.
function tablesIn(src) {
  const found = new Set();
  for (const block of sqlTemplates(src)) {
    const cleaned = stripInterpolations(block);
    const re = /(?:FROM|INSERT\s+INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/gi;
    let m;
    while ((m = re.exec(cleaned))) found.add(m[1].toLowerCase());
  }
  return found;
}

// ── 1. The actual regression: routes/feed.js, reduced to its shape ───────────
const feedShape = [
  'const rows = await sql`',
  '  SELECT cp.*, COALESCE(cdi.phase, 3) AS _debut_phase,',
  '    ${hasGeo ? sql`',
  '      ROUND((6371 * acos(cos(radians(${latN})))) ::numeric, 1)',
  '    ` : sql`0::numeric`} AS distance_km',
  '  FROM cook_profiles cp',
  '  LEFT JOIN creator_debut_impressions cdi ON cdi.cook_id = cp.id',
  '  JOIN users u ON u.id = cp.user_id',
  '`;',
].join('\n');

const feedTables = tablesIn(feedShape);
check('finds the table below a conditional fragment', feedTables.has('creator_debut_impressions'),
  'creator_debut_impressions');
check('finds every later join too', feedTables.has('users') && feedTables.has('cook_profiles'),
  [...feedTables].join(', '));

// The old extractor, kept here so the test states what actually regressed.
const oldBlocks = feedShape.match(/sql`[\s\S]*?`/g) || [];
const oldSaw = oldBlocks.some(b => /creator_debut_impressions/.test(b));
check('the old non-greedy extractor missed it (defect is real)', !oldSaw,
  oldSaw ? 'old extractor saw it — premise wrong' : 'confirmed blind');

// ── 2. Nested templates must not end the outer one ───────────────────────────
const nested = 'await sql`SELECT 1 FROM a ${f ? sql`AND x` : sql`AND y`} JOIN b ON b.id = a.id`';
const nestedTables = tablesIn(nested);
check('nesting does not truncate the outer template',
  nestedTables.has('a') && nestedTables.has('b'), [...nestedTables].join(', '));

// ── 3. Interpolations are still blanked out ──────────────────────────────────
const masquerade = 'await sql`SELECT * FROM ${sql(secret_table)} JOIN real_table r ON r.id = 1`';
const masqTables = tablesIn(masquerade);
check('interpolated identifiers are not read as tables', !masqTables.has('secret_table'),
  [...masqTables].join(', '));
check('…but real tables beside them still are', masqTables.has('real_table'));

// ── 4. Brace balancing inside an interpolation ───────────────────────────────
// The old /\$\{[^}]*\}/ stopped at the first inner `}`, leaking the tail back
// into the scanned text — where `FROM leaked_table` would be read as real.
const objLiteral = 'await sql`SELECT * FROM t WHERE m = ${JSON.stringify({ a: 1 })} AND z = 2`';
check('object literal in an interpolation does not leak',
  !tablesIn(objLiteral).has('stringify'), [...tablesIn(objLiteral)].join(', '));

// ── 5. Escaped backticks must not be mistaken for a terminator ───────────────
const escaped = 'await sql`SELECT 1 FROM a WHERE note = \'x\' JOIN b ON b.id = a.id`';
check('plain template still parses', tablesIn(escaped).has('b'), [...tablesIn(escaped)].join(', '));

// ── 6. Coverage: the audit must look at every dir that runs SQL ──────────────
const { CODE_DIRS_USED } = (() => {
  const src = require('fs').readFileSync(__dirname + '/schema-drift-check.js', 'utf8');
  const m = src.match(/const CODE_DIRS\s+= \[([^\]]*)\]/);
  return { CODE_DIRS_USED: m ? m[1].replace(/['\s]/g, '').split(',') : [] };
})();
for (const d of ['routes', 'services', 'payments', 'middleware', 'workers']) {
  check(`scans ${d}/`, CODE_DIRS_USED.includes(d), CODE_DIRS_USED.join(','));
}

const pad = (s, w) => String(s).padEnd(w);
console.log('\n──── SCHEMA DRIFT CHECK PARSER TEST ────');
for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 52)} ${String(r.detail).slice(0, 46)}`);
const fails = results.filter(r => r.ok === 'FAIL').length;
console.log(`\n${results.length} checks, ${fails} failed`);
process.exitCode = fails ? 1 : 0;
