/**
 * Dollar-quote aware migration runner for Neon serverless.
 * Usage: node scripts/run_migration.js <path_to_migration.sql>
 */
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);

/**
 * Split a SQL file into individual statements, handling:
 * - Dollar-quoted strings ($$ ... $$ or $tag$ ... $tag$)
 * - Line comments (-- ...)
 * - Statement delimiter (;)
 */
function splitStatements(src) {
  const stmts = [];
  let current = '';
  let inDollar = false;
  let dollarTag = '';
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // Check for start/end of dollar-quoted string
    if (ch === '$') {
      // Scan forward to find the closing $
      let j = i + 1;
      while (j < src.length && src[j] !== '$') j++;
      if (j < src.length) {
        const tag = src.slice(i, j + 1); // e.g. "$func$" or "$$"
        if (!inDollar) {
          inDollar = true;
          dollarTag = tag;
          current += tag;
          i = j + 1;
          continue;
        } else if (tag === dollarTag) {
          inDollar = false;
          dollarTag = '';
          current += tag;
          i = j + 1;
          continue;
        }
      }
    }

    // Skip line comments outside dollar strings
    if (!inDollar && ch === '-' && src[i + 1] === '-') {
      // Skip to end of line but keep the newline
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }

    // Statement delimiter
    if (!inDollar && ch === ';') {
      const stmt = current.trim();
      if (stmt.length > 0) stmts.push(stmt);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const last = current.trim();
  if (last.length > 0) stmts.push(last);
  return stmts;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/run_migration.js <path>');
    process.exit(1);
  }

  const src = fs.readFileSync(path.resolve(file), 'utf8');
  const statements = splitStatements(src);

  console.log(`Running ${statements.length} statement(s) from ${path.basename(file)}\n`);

  let ok = 0;
  let errors = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 70).replace(/\s+/g, ' ');
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);
    try {
      await sql(stmt);
      console.log('OK');
      ok++;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${ok} succeeded, ${errors} failed.`);
  if (errors > 0) process.exit(1);
}

main();
