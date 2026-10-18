// Fails when a locale file would show users something broken. en.json is the source
// of truth; every other locale must have every key, with exactly the same
// {{placeholders}}.
//
// This exists because 11 locales once shipped ~780 strings translated from JSX
// source instead of from en.json: users saw "Jour ${i + 1}", "wallet-outline" and
// a bare "s" where a count belonged. A key whose placeholders differ from English
// either drops the value or prints the variable name, and nothing else catches it.
//
// Usage: node scripts/check-i18n.js   (from mobile/)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES = path.join(ROOT, 'src/i18n/locales');
const CODE_DIRS = ['app', 'src'];

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
const load = (file) => flatten(JSON.parse(fs.readFileSync(path.join(LOCALES, file), 'utf8')));
const placeholders = (s) =>
  typeof s === 'string' ? (s.match(/{{\s*\w+\s*}}/g) || []).map((p) => p.replace(/\s/g, '')).sort().join(',') : '';
// Leftovers of a translator fed source code: ${expr}, {expr.with.dots}, optional chaining.
const looksLikeCode = (s) => typeof s === 'string' && (/\$\{|\?\.|=>/.test(s) || /(^|[^{]){[^{}]*[.(][^{}]*}/.test(s));

const en = load('en.json');
const problems = [];

for (const file of fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json') && f !== 'en.json').sort()) {
  const locale = load(file);
  const loc = file.replace('.json', '');
  for (const [key, english] of Object.entries(en)) {
    if (!(key in locale)) problems.push(`${loc}: missing ${key}`);
    else if (placeholders(locale[key]) !== placeholders(english)) problems.push(`${loc}: placeholders differ in ${key}: ${JSON.stringify(locale[key])}`);
    else if (looksLikeCode(locale[key])) problems.push(`${loc}: looks like source code in ${key}: ${JSON.stringify(locale[key])}`);
  }
  for (const key of Object.keys(locale)) if (!(key in en)) problems.push(`${loc}: ${key} is not in en.json`);
}

// Every literal t('a.b') key in the code must exist in English, or users see the raw key.
const enKeys = Object.keys(en);
const resolves = (k) => k in en || `${k}_one` in en || `${k}_other` in en || enKeys.some((e) => e.startsWith(`${k}.`));
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'locales' && entry.name !== 'node_modules') walk(p); continue; }
    if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
      if (!resolves(m[1])) problems.push(`code: ${path.relative(ROOT, p)} uses ${m[1]}, which en.json lacks`);
    }
  }
}
CODE_DIRS.forEach((d) => walk(path.join(ROOT, d)));

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\ncheck-i18n: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`check-i18n: ok — ${enKeys.length} keys, every locale complete and placeholder-consistent`);
