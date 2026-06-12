#!/usr/bin/env node
/**
 * Applies pending migrations to Neon DB.
 * All DDL uses IF NOT EXISTS so re-running is always safe.
 * Usage: node scripts/run-migrations.js
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

// Ordered list — all idempotent, safe to re-run
const PENDING = [
  '022_social_oauth.sql',
  '024_health_kitchen_v2.sql',
  '025_tos_consent.sql',
  '026_otp_rate_limit_payout_failure.sql',
  '027_trgm_search.sql',
  '028_schema_drift.sql',
  '029_users_country_code.sql',
  '030_cook_profiles_currency_code.sql',
  '031_diary_pinned_posts.sql',
  '032_tips_payout_status.sql',
];

const sql = neon(DB_URL);

function splitStatements(src) {
  // Remove comment-only lines, split on semicolons, drop blanks
  return src
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function main() {
  const dir = path.join(__dirname, '..', 'migrations');

  for (const file of PENDING) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    const stmts = splitStatements(src);
    console.log(`\n▶  ${file}  (${stmts.length} statement${stmts.length !== 1 ? 's' : ''})`);

    for (const stmt of stmts) {
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
      try {
        // neon() called as a plain function accepts raw SQL with no params
        await sql(stmt + ';');
        console.log(`  ✓  ${preview}`);
      } catch (err) {
        // IF NOT EXISTS guards should prevent most errors; log and continue
        const msg = err.message ?? String(err);
        if (/already exists/i.test(msg) || /duplicate/i.test(msg)) {
          console.log(`  ~  skipped (already exists): ${preview}`);
        } else {
          console.error(`  ✗  FAILED: ${preview}`);
          console.error(`     ${msg}`);
          process.exit(1);
        }
      }
    }

    console.log(`  ✅  ${file} applied`);
  }

  console.log('\n🎉  All migrations applied.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
