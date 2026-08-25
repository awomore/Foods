// Creates (or promotes) an admin account.
//
// The admin portal is gated by roleGuard('admin') against users.role, and
// production currently has NO row with that role — nobody can get in. This is the
// safe way to fix that, rather than a hand-typed UPDATE against production.
//
// DRY RUN BY DEFAULT.
//
//   node scripts/make-admin.js 2348012345678 "Olusegun"
//   node scripts/make-admin.js 2348012345678 "Olusegun" --apply
//   DATABASE_URL="<railway url>" node scripts/make-admin.js ... --apply
//
// It will NOT promote an existing cook or customer unless you pass --promote,
// because users.role is single-valued (CHECK customer/cook/admin) and thirty
// places in the backend branch on role === 'cook' — including the login response,
// which only returns cook_id for a cook. Promoting a cook trades one account for
// the other. Give the admin its own number instead.
require('dotenv').config();
const { sql } = require('../supabase/db');
const { phoneKey } = require('../utils/phone');

const args = process.argv.slice(2);
const APPLY   = args.includes('--apply');
const PROMOTE = args.includes('--promote');
const positional = args.filter(a => !a.startsWith('--'));
const [phone, fullName] = positional;

const host = (process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0] || 'unknown';

(async () => {
  if (!phone) {
    console.log('\nUsage: node scripts/make-admin.js <phone> ["Full Name"] [--apply] [--promote]\n');
    process.exit(1);
  }
  // Same shape verify-otp validates, so the number we create is one the app can
  // actually log in with.
  if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
    console.log(`\n"${phone}" is not a valid international number.`);
    console.log('Use the form the app sends, e.g. 2348012345678 — no leading zero.\n');
    process.exit(1);
  }

  console.log(`\nDatabase: ${host}`);
  console.log(APPLY ? 'Mode:     APPLY — this will write' : 'Mode:     dry run — nothing will be written');
  console.log(`Phone:    ${phone}  (national key ${phoneKey(phone)})\n`);

  // Match the way login will find this row, so we cannot create something the app
  // then fails to reach, or a second row for a number that already has one.
  const existing = await sql`
    SELECT id, phone, role, full_name, is_active, created_at FROM users
     WHERE phone = ${phone}
        OR RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = ${phoneKey(phone)}
     ORDER BY (phone = ${phone}) DESC, created_at ASC`;

  const admins = await sql`SELECT phone, full_name FROM users WHERE role = 'admin'`;
  console.log(admins.length
    ? `Existing admins: ${admins.map(a => `${a.phone} (${a.full_name || 'no name'})`).join(', ')}\n`
    : 'Existing admins: none — nobody can currently enter the admin portal.\n');

  let action, target = existing[0];

  if (!target) {
    action = 'create';
  } else if (target.role === 'admin') {
    console.log(`Already an admin: ${target.phone} — ${target.full_name || 'no name'}`);
    console.log('Nothing to do.\n');
    await sql.end();
    return;
  } else if (target.role === null) {
    action = 'promote';
  } else if (PROMOTE) {
    action = 'promote';
  } else {
    console.log(`REFUSED. That number already belongs to a ${target.role}:`);
    console.log(`  ${target.phone}  ${target.full_name || '(no name)'}  ${target.id}\n`);
    console.log('users.role holds ONE value, and 30 places branch on role === \'cook\' —');
    console.log('including the login response, which only returns cook_id for a cook.');
    console.log('Promoting this row would trade that account for an admin one.\n');
    console.log('Use a different number for the admin, or pass --promote if you really');
    console.log('mean to convert this account.\n');
    await sql.end();
    process.exit(1);
  }

  if (action === 'create') {
    console.log(`Would CREATE a new admin: ${phone}  ${fullName || '(no name)'}`);
  } else {
    console.log(`Would PROMOTE ${target.phone} (${target.role || 'no role'}) to admin`);
    console.log(`  ${target.id}`);
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to write.\n');
    await sql.end();
    return;
  }

  const now = new Date().toISOString();
  let row;
  if (action === 'create') {
    // Terms are recorded here because verify-otp only records them when IT creates
    // the row; a pre-made account would otherwise never have them.
    [row] = await sql`
      INSERT INTO users (phone, full_name, role, is_active,
                         tos_accepted_at, tos_version, privacy_accepted_at)
      VALUES (${phone}, ${fullName || null}, 'admin', true, ${now}, '1.0', ${now})
      RETURNING id, phone, role, full_name`;
  } else {
    [row] = await sql`
      UPDATE users SET role = 'admin',
                       full_name = COALESCE(${fullName || null}, full_name),
                       is_active = true
       WHERE id = ${target.id}
       RETURNING id, phone, role, full_name`;
  }

  console.log(`\n✓ ${action === 'create' ? 'Created' : 'Promoted'}: ${row.phone} — role ${row.role}`);
  console.log(`  ${row.id}`);
  console.log('\nLog in from the app with this number; the OTP arrives by SMS as usual.\n');

  await sql.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
