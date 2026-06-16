// One-shot migration runner — applies all .sql files in ../migrations/ in order.
// Safe to re-run: every statement uses IF NOT EXISTS / IF EXISTS guards.
// Usage: node scripts/apply-migrations.js
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs   = require('fs');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);
const migrationsDir = path.join(__dirname, '..', 'migrations');

// Split SQL respecting $$-quoted PL/pgSQL blocks and -- line comments
function splitStatements(content) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let inLineComment = false;
  let i = 0;
  while (i < content.length) {
    // Track line-comment state
    if (!inDollarQuote && !inLineComment && content.slice(i, i + 2) === '--') {
      inLineComment = true; current += '--'; i += 2; continue;
    }
    if (inLineComment && content[i] === '\n') {
      inLineComment = false;
    }
    // Dollar-quote blocks
    if (!inDollarQuote && !inLineComment && content.slice(i, i + 2) === '$$') {
      inDollarQuote = true; current += '$$'; i += 2; continue;
    }
    if (inDollarQuote && content.slice(i, i + 2) === '$$') {
      inDollarQuote = false; current += '$$'; i += 2; continue;
    }
    // Statement delimiter — only outside quotes and comments
    if (!inDollarQuote && !inLineComment && content[i] === ';') {
      const stmt = current.replace(/--[^\n]*/g, '').trim();
      if (stmt.length > 0) statements.push(current.trim());
      current = ''; i++; continue;
    }
    current += content[i]; i++;
  }
  const last = current.replace(/--[^\n]*/g, '').trim();
  if (last.length > 0) statements.push(current.trim());
  return statements;
}

(async () => {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.\n`);

  for (const file of files) {
    const content    = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = splitStatements(content);
    process.stdout.write(`  ${file} (${statements.length} stmts) … `);
    let ok = true;
    for (const stmt of statements) {
      try {
        await sql(stmt);
      } catch (err) {
        if (
          err.message?.includes('already exists') ||
          err.message?.includes('duplicate') ||
          err.message?.includes('multiple primary keys')
        ) {
          // idempotency — safe to skip
        } else {
          console.log(`\n    ERROR in ${file}: ${err.message}`);
          ok = false;
          break;
        }
      }
    }
    if (ok) console.log('OK');
    else process.exit(1);
  }

  console.log('\nAll migrations complete.');
})();
