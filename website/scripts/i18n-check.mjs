// Checks every translation in messages/ against messages/en.json:
//   - same keys and the same array lengths,
//   - every {placeholder} kept,
//   - the same number of *accent* markers.
// Usage: node scripts/i18n-check.mjs [lang…]   (exit code 1 on any problem)

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages');
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'));
const langs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json').map((f) => f.slice(0, -5));

const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
const stars = (s) => (s.match(/\*/g) || []).length;

let failed = false;
for (const lang of langs) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8'));
  } catch (e) {
    console.log(`${lang}: cannot parse — ${e.message}`);
    failed = true;
    continue;
  }
  const problems = [];
  let strings = 0;
  let same = 0;
  const walk = (a, b, path) => {
    if (typeof a === 'string') {
      if (typeof b !== 'string') return problems.push(`${path}: missing`);
      strings++;
      if (a === b && a.length > 3 && !/^[A-Z0-9 .:@/+-]+$/i.test(a)) same++;
      if (placeholders(a) !== placeholders(b)) problems.push(`${path}: placeholders ${placeholders(a)} ≠ ${placeholders(b)}`);
      if (stars(a) !== stars(b)) problems.push(`${path}: accent markers ${stars(a)} ≠ ${stars(b)}`);
      if (!b.trim()) problems.push(`${path}: empty`);
      return;
    }
    if (Array.isArray(a)) {
      if (!Array.isArray(b)) return problems.push(`${path}: missing array`);
      if (a.length !== b.length) return problems.push(`${path}: ${b.length} items, expected ${a.length}`);
      a.forEach((x, i) => walk(x, b[i], `${path}[${i}]`));
      return;
    }
    if (!b || typeof b !== 'object') return problems.push(`${path}: missing section`);
    for (const k of Object.keys(a)) walk(a[k], b[k], path ? `${path}.${k}` : k);
    for (const k of Object.keys(b)) if (!(k in a)) problems.push(`${path ? path + '.' : ''}${k}: not in en.json`);
  };
  walk(en, doc, '');
  if (problems.length) failed = true;
  console.log(`${lang}: ${problems.length ? `${problems.length} problem(s)` : 'ok'} · ${strings} strings · ${same} identical to English`);
  for (const p of problems.slice(0, 15)) console.log(`   ${p}`);
}
process.exit(failed ? 1 : 0);
