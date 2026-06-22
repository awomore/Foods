require('dotenv').config();
const { Client } = require('postgres');
const fs = require('fs');
const path = require('path');

const client = new Client(process.env.DATABASE_URL);

// Split SQL respecting $$-quoted blocks (PL/pgSQL functions)
function splitStatements(content) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let i = 0;

  while (i < content.length) {
    if (!inDollarQuote && content.slice(i, i + 2) === '$$') {
      inDollarQuote = true;
      current += '$$';
      i += 2;
      continue;
    }
    if (inDollarQuote && content.slice(i, i + 2) === '$$') {
      inDollarQuote = false;
      current += '$$';
      i += 2;
      continue;
    }
    if (!inDollarQuote && content[i] === ';') {
      const stmt = current.replace(/--[^\n]*/g, '').trim();
      if (stmt.length > 0) statements.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += content[i];
    i++;
  }

  const last = current.replace(/--[^\n]*/g, '').trim();
  if (last.length > 0) statements.push(current.trim());

  return statements;
}

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');

    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const statements = splitStatements(content);
      console.log(`\nRunning ${file} (${statements.length} statements)...`);
      try {
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          await client.query(stmt);
          console.log(`  ✓ Statement ${i + 1}/${statements.length}`);
        }
        console.log(`✓ ${file} completed`);
      } catch (err) {
        console.error(`✗ ${file}: ${err.message}`);
        process.exit(1);
      }
    }

    console.log('\n✓ All migrations complete.');
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();

