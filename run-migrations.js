// Run all migrations against Neon in order
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://neondb_owner:npg_5aBtTIGHhfO6@ep-winter-art-ab8y8h3y.eu-west-2.aws.neon.tech/neondb?sslmode=require';
const sql = neon(DATABASE_URL);

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

async function run() {
  console.log(`Found ${files.length} migration files\n`);
  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running ${file}...`);
    try {
      await sql.unsafe(content);
      console.log(`  ✓ done\n`);
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log(`  ⚠  already exists — skipping\n`);
      } else {
        console.error(`  ✗ FAILED: ${err.message}\n`);
        process.exit(1);
      }
    }
  }
  console.log('All migrations complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
