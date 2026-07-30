// Audits every jsonb column that was written by the double-encoding pattern
// `${JSON.stringify(x)}::jsonb`, which makes postgres.js store a jsonb STRING
// scalar instead of the intended object/array. Structural reads (JS property
// access, `col->>'key'`, Array.isArray) then silently see nothing.
//
// Prints the jsonb_typeof distribution per column and flags any column holding
// string scalars. Safe and read-only — run it before and after deploying a
// repair migration.
//
// Usage: cd backend; node scripts/jsonb-encoding-audit.js
require('dotenv').config();
const { sql } = require('../supabase/db');

// Every column the pattern ever wrote to.
const TARGETS = [
  ['analytics_events',         'properties'],
  ['notifications',            'data'],
  ['menu_items',               'sides'],
  ['cook_profiles',            'open_hours_by_day'],
  ['cook_profiles',            'brand_colors'],
  ['private_chef_bookings',    'quote_breakdown'],
  ['customer_interest_graphs', 'cuisine_affinities'],
  ['chef_availability',        'time_slots'],
  ['catering_events',          'timeline'],
  ['fraud_signals',            'details'],
  ['courses',                  'lessons'],
  ['chef_service_settings',    'guest_tiers'],
  ['diary_comments',           'mentions'],
  ['custom_requests',          'quote_versions'],
  ['zones',                    'service_areas'],
  ['invoices',                 'line_items'],
  ['orders',                   'selected_sides'],
  ['orders',                   'removed_sides'],
  ['private_chef_bookings',    'milestone_payments'],
  ['quotations',               'line_items'],
  ['weekly_menus',             'items'],
  ['cook_profiles',            'social_oauth_data'],
];

(async () => {
  // Proves the distinction on the live server rather than assuming it.
  const [enc] = await sql`
    SELECT jsonb_typeof(${JSON.stringify({ a: 1 })}::jsonb) AS json_stringify,
           jsonb_typeof(${sql.json({ a: 1 })}::jsonb)       AS sql_json_object,
           jsonb_typeof(${sql.json([1, 2])}::jsonb)         AS sql_json_array
  `;
  console.log('encoding check →', enc, '\n(json_stringify must read "string" — that is the bug)\n');

  let broken = 0;
  for (const [table, col] of TARGETS) {
    try {
      const rows = await sql`
        SELECT jsonb_typeof(${sql(col)}) AS kind, count(*)::int AS n
        FROM ${sql(table)} GROUP BY 1 ORDER BY 2 DESC
      `;
      const summary = rows.length
        ? rows.map(r => `${r.kind ?? 'null'}=${r.n}`).join('  ')
        : '(no rows)';
      const bad = rows.find(r => r.kind === 'string');
      if (bad) broken++;
      console.log(`${bad ? 'BROKEN' : '  ok  '}  ${`${table}.${col}`.padEnd(44)} ${summary}`);
    } catch (e) {
      console.log(`  ERR   ${`${table}.${col}`.padEnd(44)} ${e.message.split('\n')[0]}`);
    }
  }

  console.log(`\n${broken} column(s) hold double-encoded string scalars.`);
  await sql.end();
  process.exit(broken ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
