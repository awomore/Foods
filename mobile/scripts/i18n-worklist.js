#!/usr/bin/env node
/**
 * Lists, per locale, every key a translator still has to do:
 *   - missing: the key exists in en.json but not in the locale
 *   - english: the locale's value is still the English text
 *
 * "Still English" ignores values that are legitimately the same in many
 * languages: brand names, codes, single words such as "Video" or "Status",
 * and anything listed in i18n-same-as-english.json for that locale.
 *
 * Usage:
 *   node scripts/i18n-worklist.js              summary table
 *   node scripts/i18n-worklist.js --out DIR    also write DIR/<locale>.json  { key: englishText }
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES = path.join(ROOT, 'src/i18n/locales');
const ALLOW_FILE = path.join(__dirname, 'i18n-same-as-english.json');
// Generated per locale from CLDR (scripts/gen-intl-names.js) — never hand-translated.
const GENERATED = /^(country_names|currency_names)\./;

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
const load = (f) => flatten(JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8')));

/** True when an identical-to-English value is plausibly correct and not a gap. */
function sameIsFine(english) {
  const text = String(english).replace(/{{\s*\w+\s*}}/g, '').trim();
  if (!/[a-z]{2}/i.test(text)) return true;                 // symbols, numbers, placeholders only
  if (!/\s/.test(text)) return true;                         // one word: cognates (Video, Status, Menu, OK)
  if (/^(FOODS|FOODSbyme|Chowdeck|Relay by Chowdeck|WhatsApp|Instagram|TikTok|YouTube|X \/ Twitter|Google|Apple|Flutterwave|Bachs)\b/.test(text) && text.split(/\s+/).length <= 3) return true;
  return false;
}

/**
 * Plural forms a language needs beyond English's _one/_other: Russian "5 заказов" is
 * _many, Arabic has _zero/_two/_few/_many. Without them i18next falls back to English.
 * Returns { 'a.b_few': 'a.b_other', ... } — each extra key and the English key it translates.
 */
function extraPluralKeys(en, loc) {
  let cats;
  try { cats = new Intl.PluralRules(loc).resolvedOptions().pluralCategories; } catch { return {}; }
  const out = {};
  for (const k of Object.keys(en)) {
    if (!k.endsWith('_other') || !/{{\s*count\s*}}/.test(en[k])) continue; // only real counts
    const base = k.slice(0, -'_other'.length);
    for (const c of cats) if (c !== 'one' && c !== 'other') out[`${base}_${c}`] = k;
  }
  return out;
}

function worklist() {
  const en = load('en.json');
  const allow = fs.existsSync(ALLOW_FILE) ? JSON.parse(fs.readFileSync(ALLOW_FILE, 'utf8')) : {};
  const result = {};
  for (const file of fs.readdirSync(LOCALES).filter(f => f.endsWith('.json') && f !== 'en.json').sort()) {
    const loc = file.replace('.json', '');
    const l = load(file);
    const allowed = new Set([...(allow['*'] || []), ...(allow[loc] || [])]);
    const missing = {}, english = {};
    for (const [k, v] of Object.entries(en)) {
      if (GENERATED.test(k)) continue;
      if (!(k in l)) missing[k] = v;
      else if (l[k] === v && !allowed.has(k) && !sameIsFine(v)) english[k] = v;
    }
    for (const [k, from] of Object.entries(extraPluralKeys(en, loc))) {
      if (!(k in l)) missing[k] = en[from];
    }
    result[loc] = { missing, english };
  }
  return result;
}

module.exports = { worklist, sameIsFine, extraPluralKeys };

if (require.main === module) {
  const w = worklist();
  const outIdx = process.argv.indexOf('--out');
  const outDir = outIdx > 0 ? process.argv[outIdx + 1] : null;
  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  let total = 0;
  for (const [loc, { missing, english }] of Object.entries(w)) {
    const m = Object.keys(missing).length, e = Object.keys(english).length;
    total += m + e;
    console.log(`${loc.padEnd(8)} missing ${String(m).padStart(5)}   still English ${String(e).padStart(5)}`);
    if (outDir) fs.writeFileSync(path.join(outDir, `${loc}.json`), JSON.stringify({ ...missing, ...english }, null, 1));
  }
  console.log(`total to translate: ${total}`);
}
