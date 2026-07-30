// Integration test for migration 062 — the search_trending counters, and the
// column-name fixes that go with them.
//
// The bug this locks down: services/trending.js selected `term`, `search_count`
// and `created_at` from a table whose columns are `query`, `count` and
// `last_seen`. That threw `column "term" does not exist`, and because
// computeSearchTrending runs inside a Promise.all in computeAll(), it failed the
// ENTIRE 2-hourly trending job — dishes and creators included. So this asserts
// the real scoring query runs and produces the right numbers, plus that the
// per-search counter increment actually finds its row (it matched on the raw
// query where upsert_trending_search stores lower(trim(...)), so it never did).
//
// EVERYTHING RUNS IN ONE TRANSACTION THAT IS ALWAYS ROLLED BACK.
//
// Usage: cd backend; DATABASE_URL=<url> node scripts/search-trending-test.js
//    or: railway run --service Postgres node scripts/search-trending-test.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'PASS' : 'FAIL', detail });
const near = (a, b, eps = 1e-9) => a !== null && a !== undefined && Math.abs(Number(a) - b) < eps;

const clamp = (v, max = 1) => Math.max(0, Math.min(max, v ?? 0));

(async () => {
  const sql = postgres(DB_URL, { ssl: 'require', max: 1, onnotice: () => {} });
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '062_search_trending_counters.sql'), 'utf8');

  try {
    await sql.begin(async tx => {
      await tx.unsafe(migration);
      check('migration 062 applies', true);

      const cols = await tx`
        SELECT column_name, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name='search_trending'
          AND column_name IN ('unique_user_count','order_conversion_count')`;
      check('both counters exist, NOT NULL, default 0',
        cols.length === 2 && cols.every(c => c.is_nullable === 'NO' && String(c.column_default).startsWith('0')),
        cols.map(c => `${c.column_name}=${c.column_default}`).join(' '));

      // ── Seed, scoped so production's real rows cannot move the maxima ───────
      const seed = (q, count, uniq, conv, daysAgo) => tx`
        INSERT INTO search_trending (query, count, unique_user_count, order_conversion_count, last_seen)
        VALUES (${q}, ${count}, ${uniq}, ${conv}, NOW() - ${daysAgo + ' days'}::interval)`;
      await seed('zz jollof', 10, 4, 2, 1);
      await seed('zz egusi',   5, 2, 0, 2);
      await seed('zz stale',  99, 9, 9, 8);   // outside the 7-day window

      // The real computeSearchTrending query (scoped with the LIKE).
      const rows = await tx`
        SELECT
          query AS entity_label,
          SUM(count)                   AS raw_count,
          MAX(unique_user_count)       AS unique_users,
          MAX(order_conversion_count)  AS conversions
        FROM search_trending
        WHERE last_seen >= NOW() - INTERVAL '7 days' AND query LIKE 'zz %'
        GROUP BY query
        ORDER BY raw_count DESC
        LIMIT 30`;

      check('the scoring query runs at all (was: column "term" does not exist)', true);
      check('the 8-day-old term is outside the window',
        rows.length === 2 && !rows.some(r => r.entity_label === 'zz stale'), `${rows.length} rows`);

      const max_count  = Math.max(...rows.map(r => parseFloat(r.raw_count)    || 0), 1);
      const max_unique = Math.max(...rows.map(r => parseFloat(r.unique_users) || 0), 1);
      const max_conv   = Math.max(...rows.map(r => parseFloat(r.conversions)  || 0), 1);
      const scored = {};
      for (const row of rows) {
        scored[row.entity_label] = clamp(
          ((parseFloat(row.raw_count)    || 0) / max_count)  * 0.4 +
          ((parseFloat(row.conversions)  || 0) / max_conv)   * 0.4 +
          ((parseFloat(row.unique_users) || 0) / max_unique) * 0.2
        );
      }
      // jollof tops every axis → 1.0. egusi: 0.5*0.4 + 0*0.4 + 0.5*0.2 = 0.3
      check('top term scores 1.0 across all three axes', near(scored['zz jollof'], 1.0), `${scored['zz jollof']}`);
      check('a term with no conversions scores 0.3', near(scored['zz egusi'], 0.3, 1e-9), `${scored['zz egusi']}`);

      // Writing those into trending_entities is what the job actually does.
      for (const [label, score] of Object.entries(scored)) {
        await tx`INSERT INTO trending_entities (entity_type, entity_label, trending_score, computed_at)
                 VALUES ('search', ${label}, ${score}, NOW())`;
      }
      const written = await tx`
        SELECT entity_label, trending_score FROM trending_entities
        WHERE entity_type='search' AND entity_label LIKE 'zz %' ORDER BY trending_score DESC`;
      check('search rows land in trending_entities in rank order',
        written.length === 2 && written[0].entity_label === 'zz jollof', `${written.map(w => w.entity_label).join(' > ')}`);

      // ── The counter increment from routes/search.js ─────────────────────────
      // upsert_trending_search stores lower(trim(q)); the increment must match that.
      await tx`SELECT upsert_trending_search(${'  ZZ Suya  '})`;
      const [created] = await tx`SELECT query, count, unique_user_count FROM search_trending WHERE query = 'zz suya'`;
      check('upsert_trending_search normalises to lower(trim(...))',
        created && created.count === 1 && created.unique_user_count === 0, `${created?.query}/${created?.count}`);

      await tx`UPDATE search_trending SET unique_user_count = unique_user_count + 1
               WHERE query = lower(trim(${'  ZZ Suya  '}))`;
      const [bumped] = await tx`SELECT unique_user_count FROM search_trending WHERE query = 'zz suya'`;
      check('the unique-user increment finds its row', bumped.unique_user_count === 1, `${bumped.unique_user_count}`);

      // The old predicate, for contrast: it could never have matched.
      const stale = await tx`UPDATE search_trending SET unique_user_count = unique_user_count
                             WHERE query = ${'  ZZ Suya  '} RETURNING query`;
      check('the un-normalised predicate matches nothing (the old bug)', stale.length === 0, `${stale.length} rows`);

      // ── GET /api/search/trending ────────────────────────────────────────────
      const endpoint = await tx`
        SELECT query, count, unique_user_count, order_conversion_count
        FROM search_trending
        WHERE last_seen > now() - INTERVAL '7 days'
        ORDER BY (
          COALESCE(count, 0)     * 0.4 +
          order_conversion_count * 0.4 +
          unique_user_count      * 0.2
        ) DESC
        LIMIT 10`;
      check('GET /search/trending query executes and returns {query,count}',
        endpoint.length > 0 && 'query' in endpoint[0] && 'count' in endpoint[0],
        `${endpoint.length} rows, keys: ${Object.keys(endpoint[0] ?? {}).join(',')}`);

      throw new Error('__ROLLBACK__');
    });
  } catch (e) {
    if (e.message !== '__ROLLBACK__') {
      console.error('\ntest error:', e.message);
      results.push({ name: 'transaction completed', ok: 'FAIL', detail: e.message.split('\n')[0] });
    }
  }

  const [{ n }] = await sql`SELECT COUNT(*)::int n FROM search_trending WHERE query LIKE 'zz %'`;
  check('rolled back — no seed rows committed', n === 0, `found ${n}`);

  await sql.end();

  const pad = (s, w) => String(s).padEnd(w);
  console.log('\n──── SEARCH TRENDING TEST (migration 062) ────');
  for (const r of results) console.log(`${pad(r.ok, 5)} ${pad(r.name, 56)} ${String(r.detail).slice(0, 50)}`);
  const fails = results.filter(r => r.ok === 'FAIL').length;
  console.log(`\n${results.length} checks, ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error('fatal:', e); process.exitCode = 1; });
