// Makes one phone number a ready-to-use Creator account, so an app-store / Meta
// reviewer who logs in via the APP_REVIEW_PHONE bypass lands directly in the
// creator experience (Profile -> Manage -> Connected Accounts) instead of the
// full onboarding flow.
//
// DRY RUN BY DEFAULT. Idempotent — safe to re-run.
//
//   node scripts/seed-review-creator.js 2348000000001
//   node scripts/seed-review-creator.js 2348000000001 --apply
//   DATABASE_URL="<railway url>" node scripts/seed-review-creator.js 2348000000001 --apply
//
// To undo: node scripts/seed-review-creator.js 2348000000001 --revert --apply
// (drops the cook_profiles row and sets role back to NULL; leaves the user row).
require('dotenv').config();
const { sql } = require('../supabase/db');
const { phoneKey } = require('../utils/phone');

const args = process.argv.slice(2);
const APPLY  = args.includes('--apply');
const REVERT = args.includes('--revert');
const phone  = args.filter(a => !a.startsWith('--'))[0];

const DISPLAY_NAME = 'FOODSbyme Review';
const USERNAME     = 'foodsbymereview';

const host = (process.env.DATABASE_URL || '').split('@')[1]?.split('/')[0] || 'unknown';

(async () => {
  if (!phone || !/^\+?[1-9]\d{7,14}$/.test(phone)) {
    console.log('\nUsage: node scripts/seed-review-creator.js <phone> [--apply] [--revert]');
    console.log('Phone in the form the app sends, e.g. 2348000000001 — no leading zero.\n');
    process.exit(1);
  }

  console.log(`\nDatabase: ${host}`);
  console.log(APPLY ? 'Mode:     APPLY — this will write' : 'Mode:     dry run — nothing will be written');
  console.log(`Phone:    ${phone}  (national key ${phoneKey(phone)})`);
  console.log(`Action:   ${REVERT ? 'REVERT' : 'seed creator'}\n`);

  const key = phoneKey(phone);
  const found = await sql`
    SELECT id, phone, role, full_name FROM users
    WHERE phone = ${phone}
       OR (${key} <> '' AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = ${key})
    ORDER BY (phone = ${phone}) DESC, created_at ASC
    LIMIT 1
  `;
  let user = found[0];

  if (REVERT) {
    if (!user) { console.log('No matching user — nothing to revert.\n'); process.exit(0); }
    console.log(`Would drop cook_profiles for user ${user.id} and set role NULL (currently '${user.role}').\n`);
    if (APPLY) {
      await sql`DELETE FROM cook_profiles WHERE user_id = ${user.id}`;
      await sql`UPDATE users SET role = NULL WHERE id = ${user.id}`;
      console.log('Reverted.\n');
    }
    process.exit(0);
  }

  if (!user) {
    console.log(`No user for ${phone} yet — would INSERT one (role 'cook', name '${DISPLAY_NAME}').`);
    if (APPLY) {
      const now = new Date().toISOString();
      user = (await sql`
        INSERT INTO users (phone, role, full_name, is_active, tos_accepted_at, tos_version, privacy_accepted_at)
        VALUES (${phone}, 'cook', ${DISPLAY_NAME}, true, ${now}, '1.0', ${now})
        RETURNING id, phone, role, full_name
      `)[0];
      console.log(`Inserted user ${user.id}.`);
    }
  } else {
    console.log(`Found user ${user.id} (role '${user.role ?? 'NULL'}', name '${user.full_name ?? ''}').`);
    if (user.role && user.role !== 'cook') {
      console.log(`\nWARNING: role is '${user.role}', not 'cook' or NULL. Refusing to overwrite it.`);
      console.log('Pick a phone that is not already a customer/admin.\n');
      process.exit(1);
    }
    console.log(`Would set role 'cook' and full_name '${DISPLAY_NAME}'.`);
    if (APPLY) {
      await sql`UPDATE users SET role = 'cook', full_name = ${DISPLAY_NAME} WHERE id = ${user.id}`;
    }
  }

  if (APPLY && user) {
    const takenBy = await sql`SELECT user_id FROM cook_profiles WHERE username = ${USERNAME} AND user_id <> ${user.id}`;
    if (takenBy.length) {
      console.log(`\nWARNING: username '${USERNAME}' is held by another user — leaving cook_profiles.username unset.\n`);
      await sql`
        INSERT INTO cook_profiles (user_id, display_name)
        VALUES (${user.id}, ${DISPLAY_NAME})
        ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name
      `;
    } else {
      await sql`
        INSERT INTO cook_profiles (user_id, display_name, username)
        VALUES (${user.id}, ${DISPLAY_NAME}, ${USERNAME})
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          username     = EXCLUDED.username
      `;
    }
    const [cp] = await sql`SELECT id, username, verification_status FROM cook_profiles WHERE user_id = ${user.id}`;
    console.log(`cook_profiles ${cp.id} — username '${cp.username ?? ''}', status '${cp.verification_status}'.`);
  } else if (!APPLY && user) {
    console.log(`Would UPSERT cook_profiles (user_id ${user.id}, display_name '${DISPLAY_NAME}', username '${USERNAME}').`);
  }

  console.log(APPLY ? '\nDone.\n' : '\nDry run only — re-run with --apply to write.\n');
  process.exit(0);
})();
