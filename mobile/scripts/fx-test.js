// Tests for src/utils/fx.ts, fmtCurrency and uiLocale: estimates through USD,
// stale/missing rates, the viewer-currency fallback, presets and amount parsing.
// Transpiles the TypeScript with the app's own compiler; no test runner needed.
//
// Usage: node scripts/fx-test.js   (from mobile/)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Minimal stand-ins for the native/i18n modules these files import.
let deviceLocale = { languageCode: 'zh', regionCode: 'TW', languageTag: 'zh-Hant-TW', currencyCode: 'TWD' };
const stubs = {
  i18next: { __esModule: true, default: { language: 'zh-Hant', t: (k, o) => (o && o.defaultValue) || k } },
  'expo-localization': { getLocales: () => [deviceLocale] },
};

const cache = {};
function load(rel, from) {
  if (stubs[rel]) return stubs[rel];
  const file = path.resolve(path.dirname(from), rel) + '.ts';
  if (cache[file]) return cache[file].exports;
  const src = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  const m = { exports: {} };
  cache[file] = m;
  new Function('module', 'exports', 'require', outputText)(m, m.exports, r => load(r, file));
  return m.exports;
}
const root = path.join(__dirname, '../src/utils/x.ts');
const fx = load('./fx', root);
const { fmtCurrency } = load('./format', root);
const { uiLocale } = load('../i18n/locale', root);

let passed = 0;
const fails = [];
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) passed++; else fails.push(`${name}\n  got  ${g}\n  want ${w}`);
};

// Rates as the server sends them: units per 1 USD.
const RATES = { USD: 1, NGN: 1350, TWD: 32.5, EUR: 0.9, GBP: 0.78, JPY: 158, VND: 25400 };
const now = Date.now();

eq('no table → no estimate', fx.fmtEstimate(5000, 'NGN'), null);
eq('no table → exact price only', fx.fmtMoney(5000, 'NGN'), fmtCurrency(5000, 'NGN'));

fx.setFxTable({ rates: RATES, fetchedAt: now });
fx.setViewerCurrency('TWD');

eq('locale for zh-Hant in Taiwan', uiLocale(), 'zh-Hant-TW');
eq('convert NGN→TWD goes through USD', Math.round(fx.convert(5000, 'NGN', 'TWD') * 100) / 100, Math.round(5000 / 1350 * 32.5 * 100) / 100);
eq('same currency converts to itself', fx.convert(12, 'TWD', 'TWD'), 12);
eq('estimate in viewer currency', fx.fmtEstimate(5000, 'NGN'), '≈ ' + fmtCurrency(5000 / 1350 * 32.5, 'TWD'));
eq('no estimate when price already in viewer currency', fx.fmtEstimate(100, 'TWD'), null);
eq('fmtMoney = exact + estimate', fx.fmtMoney(5000, 'NGN'), `${fmtCurrency(5000, 'NGN')} (≈ ${fmtCurrency(5000 / 1350 * 32.5, 'TWD')})`);
eq('unknown source currency → no estimate', fx.fmtEstimate(10, 'XYZ'), null);

fx.setViewerCurrency('KHR'); // a currency with no rate in this table
eq('viewer currency without a rate falls back to USD', fx.estimateCurrencyFor('NGN'), 'USD');
eq('USD fallback estimate', fx.fmtEstimate(1350, 'NGN'), '≈ ' + fmtCurrency(1, 'USD'));
eq('no USD estimate for a USD price', fx.fmtEstimate(5, 'USD'), null);

fx.setFxTable({ rates: RATES, fetchedAt: now - 8 * 24 * 3600 * 1000 });
fx.setViewerCurrency('TWD');
eq('table older than a week → no estimate', fx.fmtEstimate(5000, 'NGN'), null);
eq('stale table → no presets from rates (fallback by decimals)', fx.presetAmounts('EUR'), [10, 25, 50, 100, 200, 500]);

fx.setFxTable({ rates: RATES, fetchedAt: now });
eq('presets in EUR ≈ $5–$200', fx.presetAmounts('EUR'), [4.5, 9, 23, 45, 90, 180]);
eq('presets in NGN', fx.presetAmounts('NGN'), [6800, 14000, 34000, 68000, 140000, 270000]);
eq('presets in VND are not tiny', fx.presetAmounts('VND')[0], 130000);
eq('one dollar in EUR', fx.usdEquivalent(1, 'EUR'), 0.9);

eq('parse 12.50 EUR', fx.parseAmountInput('12.50', 'EUR'), 12.5);
eq('parse 12,50 EUR', fx.parseAmountInput('12,50', 'EUR'), 12.5);
eq('parse 5,000 NGN', fx.parseAmountInput('5,000', 'NGN'), 5000);
eq('parse 5.000 (German grouping)', fx.parseAmountInput('5.000', 'NGN'), 5000);
eq('parse 1.234.567', fx.parseAmountInput('1.234.567', 'NGN'), 1234567);
eq('parse 1,234.56', fx.parseAmountInput('1,234.56', 'USD'), 1234.56);
eq('parse with symbol', fx.parseAmountInput('€ 20', 'EUR'), 20);
eq('parse empty', fx.parseAmountInput('', 'EUR'), null);
eq('parse zero', fx.parseAmountInput('0', 'EUR'), null);
eq('NGN rounds to whole naira', fx.parseAmountInput('99.6', 'NGN'), 100);

deviceLocale = { languageCode: 'en', regionCode: 'NG', languageTag: 'en-NG', currencyCode: 'NGN' };
stubs.i18next.default.language = 'en';
eq('English on a Nigerian phone keeps en-NG', uiLocale(), 'en-NG');

console.log(`${passed} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n\n')); process.exit(1); }
