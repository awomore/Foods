// Reports accounts that share a phone number but are stored under different
// spellings of it — the duplicates the old exact-string lookup created before
// 066. READ ONLY: it changes nothing, because merging two accounts is a decision
// about whose orders, role and profile survive, not something a script should
// guess.
//
// Run against whichever database you mean to inspect — .env points at DEV:
//   node scripts/phone-collisions.js                       (dev)
//   DATABASE_URL="<railway url>" node scripts/phone-collisions.js   (production)
require('dotenv').config();
const { sql } = require('../supabase/db');

const host = (process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0] || 'unknown';

(async () => {
  console.log(`\nDatabase: ${host}\n`);

  const groups = await sql`
    WITH keyed AS (
      SELECT id, phone, role, full_name, created_at,
             RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) AS key
        FROM users
       WHERE phone IS NOT NULL
         AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') <> ''
    )
    SELECT k.*,
           (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = k.id) AS orders,
           EXISTS (SELECT 1 FROM cook_profiles c WHERE c.user_id = k.id)   AS is_cook
      FROM keyed k
     WHERE k.key IN (SELECT key FROM keyed GROUP BY key HAVING COUNT(*) > 1)
     ORDER BY k.key, k.created_at ASC`;

  if (!groups.length) {
    console.log('No collisions: every account has a distinct national number.\n');
    await sql.end();
    return;
  }

  const byKey = new Map();
  for (const row of groups) {
    if (!byKey.has(row.key)) byKey.set(row.key, []);
    byKey.get(row.key).push(row);
  }

  for (const [key, rows] of byKey) {
    console.log(`── ...${key} ${'─'.repeat(50)}`);
    rows.forEach((r, i) => {
      const age = new Date(r.created_at).toLocaleDateString('en-NG');
      const tag = i === 0 ? 'oldest' : '      ';
      console.log(
        `  ${tag}  ${String(r.phone).padEnd(16)} ${String(r.role || '-').padEnd(9)}` +
        ` ${String(r.full_name || '-').slice(0, 22).padEnd(24)}` +
        ` orders:${String(r.orders).padEnd(4)} ${r.is_cook ? 'cook-profile' : ''}  ${age}`
      );
      console.log(`          ${r.id}`);
    });
    console.log();
  }

  console.log(`${byKey.size} collision group(s), ${groups.length} accounts.\n`);
  console.log('After 066 the OLDEST row in each group is what a login resolves to,');
  console.log('unless the number is typed exactly as a newer row stores it — an exact');
  console.log('match still wins. Rows with orders or a cook profile are the ones worth');
  console.log('keeping; deciding that is yours.\n');

  await sql.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
