#!/usr/bin/env node
/**
 * Sequential migration runner — works with any PostgreSQL (Railway, Neon, etc.)
 *
 * Usage:
 *   node scripts/migrate.js              — run all pending migrations
 *   node scripts/migrate.js --dry-run    — list pending without running
 *   node scripts/migrate.js --force 040  — re-run a specific migration by prefix
 */

require('dotenv').config();
const postgres = require('postgres');
const fs   = require('fs');
const path = require('path');

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : 'prefer',
  max: 1,
  connect_timeout: 15,
  onnotice: () => {},
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const isDryRun   = process.argv.includes('--dry-run');
const forceIdx   = process.argv.indexOf('--force');
const forcePrefix = forceIdx !== -1 ? process.argv[forceIdx + 1] : null;

async function ensureTrackingTable() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedSet() {
  const rows = await sql`SELECT filename FROM _migrations`;
  return new Set(rows.map(r => r.filename));
}

function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
}

async function run() {
  await ensureTrackingTable();
  const applied = await appliedSet();
  const files   = getMigrationFiles();

  const pending = forcePrefix
    ? files.filter(f => f.startsWith(forcePrefix))
    : files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('✓ All migrations are up to date.');
    await sql.end();
    return;
  }

  console.log(`\nFound ${pending.length} pending migration${pending.length > 1 ? 's' : ''}:\n`);
  pending.forEach(f => console.log(`  ${f}`));

  if (isDryRun) {
    console.log('\n(dry-run — nothing executed)\n');
    await sql.end();
    return;
  }

  console.log('');
  for (const file of pending) {
    const filepath = path.join(MIGRATIONS_DIR, file);
    const sqlText  = fs.readFileSync(filepath, 'utf8');
    process.stdout.write(`  Running ${file} ... `);
    try {
      await sql.unsafe(sqlText);
      if (!forcePrefix) {
        await sql`INSERT INTO _migrations (filename) VALUES (${file}) ON CONFLICT DO NOTHING`;
      }
      console.log('done');
    } catch (err) {
      console.log('FAILED');
      console.error(`\n  Error in ${file}:\n  ${err.message}\n`);
      await sql.end();
      process.exit(1);
    }
  }

  console.log('\n✓ Migrations complete.\n');
  await sql.end();
}

run().catch(async err => {
  console.error('Migration runner error:', err.message);
  await sql.end();
  process.exit(1);
});
