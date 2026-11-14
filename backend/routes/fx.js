/**
 * Exchange rates for DISPLAY ESTIMATES ONLY — "₦5,000 (≈ NT$105)".
 * Nothing is ever charged, refunded or paid out at these rates.
 *
 * Every rate is quoted against USD (units of the currency per 1 USD). A rate
 * between any two currencies is derived through USD on the client:
 *   amount_in_B = amount_in_A / usd[A] * usd[B]
 *
 * Two free, keyless sources, tried in order; the last good table is kept in
 * memory and served when both fail, up to MAX_STALE_MS. Past that the endpoint
 * answers 503 and the app shows no estimate rather than a wrong one.
 */
const express = require('express');
const router = express.Router();

const REFRESH_MS = 6 * 60 * 60 * 1000;          // providers update daily
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;   // after a week, show nothing
const FETCH_TIMEOUT_MS = 8000;

const SOURCES = [
  {
    name: 'open.er-api.com',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (j) => (j && j.result === 'success' && j.rates ? j.rates : null),
  },
  {
    name: 'fawazahmed0/currency-api',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    // Lower-case codes, many crypto entries — keep 3-letter ISO codes only.
    parse: (j) => {
      if (!j || !j.usd) return null;
      const out = {};
      for (const [k, v] of Object.entries(j.usd)) if (/^[a-z]{3}$/.test(k)) out[k.toUpperCase()] = v;
      return out;
    },
  },
];

let cache = null;      // { rates, source, fetchedAt }
let inflight = null;

/** Keep only sane rates: positive finite numbers, USD pinned to 1. */
function clean(rates) {
  const out = {};
  for (const [code, v] of Object.entries(rates)) {
    const n = Number(v);
    if (/^[A-Z]{3}$/.test(code) && Number.isFinite(n) && n > 0) out[code] = n;
  }
  out.USD = 1;
  // A table without the currencies we actually trade in is broken, not partial.
  return out.NGN && out.EUR && out.GBP ? out : null;
}

async function fetchFrom(source) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(source.url, { signal: ctrl.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const rates = clean(source.parse(await resp.json()) || {});
    if (!rates) throw new Error('unusable rate table');
    return rates;
  } finally {
    clearTimeout(timer);
  }
}

async function refresh() {
  for (const source of SOURCES) {
    try {
      const rates = await fetchFrom(source);
      cache = { rates, source: source.name, fetchedAt: Date.now() };
      return cache;
    } catch (err) {
      console.warn(`[fx] ${source.name} failed: ${err.message}`);
    }
  }
  return cache; // possibly stale, possibly null
}

async function getRates() {
  const fresh = cache && Date.now() - cache.fetchedAt < REFRESH_MS;
  if (fresh) return cache;
  if (!inflight) inflight = refresh().finally(() => { inflight = null; });
  return inflight;
}

// GET /api/fx/rates — public; no user data involved.
router.get('/rates', async (_req, res) => {
  const table = await getRates();
  if (!table || Date.now() - table.fetchedAt > MAX_STALE_MS) {
    return res.status(503).json({ error: 'Exchange rates are unavailable right now.' });
  }
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    base: 'USD',
    rates: table.rates,
    source: table.source,
    fetched_at: new Date(table.fetchedAt).toISOString(),
  });
});

module.exports = router;
module.exports._internal = { clean, SOURCES, reset: () => { cache = null; } };
