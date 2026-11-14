#!/usr/bin/env node
/**
 * Writes country and currency names into every locale file, in that locale's
 * own language, from the Unicode CLDR data built into Node (Intl.DisplayNames).
 *
 *   country_names.<ISO 3166 code>   e.g. country_names.TW = "台灣" in zh-Hant
 *   currency_names.<ISO 4217 code>  e.g. currency_names.NGN = "Nigerianischer Naira" in de
 *
 * Hermes (the app's JS engine) has no Intl.DisplayNames, so the names are
 * generated here instead of looked up at runtime. Re-run after adding a
 * country to src/i18n/countries.ts or a currency to src/utils/currency.ts:
 *
 *   node scripts/gen-intl-names.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src/i18n/locales');

// The CLDR locale to ask for each of our locale files.
const CLDR = { zh: 'zh-Hans', 'zh-Hant': 'zh-Hant-TW' };

const countriesSrc = fs.readFileSync(path.join(ROOT, 'src/i18n/countries.ts'), 'utf8');
const countryCodes = [...new Set([...countriesSrc.matchAll(/code: '([A-Z]{2})'/g)].map(m => m[1]))];

const currencySrc = fs.readFileSync(path.join(ROOT, 'src/utils/currency.ts'), 'utf8');
const currencyCodes = [...new Set([...currencySrc.matchAll(/code: '([A-Z]{3})'/g)].map(m => m[1]))].sort();

let written = 0;
for (const file of fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'))) {
  const lang = file.replace(/\.json$/, '');
  const cldr = CLDR[lang] ?? lang;
  const regions = new Intl.DisplayNames([cldr, 'en'], { type: 'region', fallback: 'code' });
  const currencies = new Intl.DisplayNames([cldr, 'en'], { type: 'currency', fallback: 'code' });

  const p = path.join(LOCALES_DIR, file);
  const raw = fs.readFileSync(p, 'utf8');
  const data = JSON.parse(raw);

  data.country_names = Object.fromEntries(countryCodes.map(c => [c, regions.of(c)]));
  data.currency_names = Object.fromEntries(currencyCodes.map(c => {
    const name = currencies.of(c);
    // Capitalise the first letter for list display ("euro" → "Euro" in fr/es/it…).
    return [c, name.charAt(0).toLocaleUpperCase(cldr) + name.slice(1)];
  }));

  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(p, JSON.stringify(data, null, 2).replace(/\n/g, nl) + nl);
  written++;
}
console.log(`${written} locale files: ${countryCodes.length} countries, ${currencyCodes.length} currencies`);
