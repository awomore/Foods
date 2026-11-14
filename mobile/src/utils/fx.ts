/**
 * Display-only currency estimates: "₦5,000 (≈ NT$122)".
 *
 * The amount a customer is charged is ALWAYS shown first, exactly, in the
 * currency of the record (the dish, the order, the wallet). The estimate in
 * the viewer's currency is extra information and is never used for money.
 *
 * Rates come from GET /api/fx/rates as units-per-USD. Every conversion goes
 * through USD — the most stable reference — so A→B = amount / usd[A] * usd[B].
 * When the viewer's currency has no rate, the estimate falls back to USD.
 * When the table is missing or more than a week old, there is no estimate at
 * all: showing nothing is better than showing a wrong number.
 */
import { fmtCurrency } from './format';
import { currencyByCode } from './currency';

export interface FxTable {
  rates: Record<string, number>;
  fetchedAt: number; // ms epoch
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let table: FxTable | null = null;
let viewerCurrency = 'USD';
const listeners = new Set<() => void>();

export function setFxTable(t: FxTable | null) { table = t; listeners.forEach(l => l()); }
export function getFxTable() { return table; }
export function setViewerCurrency(code: string) { viewerCurrency = code; listeners.forEach(l => l()); }
export function getViewerCurrency() { return viewerCurrency; }
export function subscribeFx(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

function usableRate(code: string): number | null {
  if (!table || Date.now() - table.fetchedAt > MAX_AGE_MS) return null;
  const r = table.rates[code];
  return typeof r === 'number' && r > 0 ? r : null;
}

/** Convert through USD; null when either rate is unknown or the table is stale. */
export function convert(amount: number, from: string, to: string): number | null {
  if (from === to) return amount;
  const rFrom = usableRate(from);
  const rTo = usableRate(to);
  if (rFrom == null || rTo == null) return null;
  return (Number(amount) / rFrom) * rTo;
}

/** The currency an estimate for `from` should be shown in, or null for none. */
export function estimateCurrencyFor(from: string): string | null {
  if (!from) return null;
  const target = usableRate(viewerCurrency) != null ? viewerCurrency : 'USD';
  if (target === from) return null;
  return usableRate(from) != null && usableRate(target) != null ? target : null;
}

/** "≈ NT$122", or null when the viewer already sees their own currency or no rate is known. */
export function fmtEstimate(amount: number, from: string): string | null {
  const to = estimateCurrencyFor(from);
  if (!to) return null;
  const v = convert(amount, from, to);
  return v == null ? null : `≈ ${fmtCurrency(v, to)}`;
}

/**
 * The exact amount, plus an estimate in the viewer's currency when it differs:
 * "₦5,000 (≈ NT$122)". Use for prices and totals a customer reads; use plain
 * fmtCurrency for inputs and for a creator's own earnings.
 */
export function fmtMoney(amount: number, currency: string): string {
  const exact = fmtCurrency(amount, currency);
  const est = fmtEstimate(amount, currency);
  return est ? `${exact} (${est})` : exact;
}

/** Round to two significant figures for friendly presets: 12,345 → 12,000; 0.47 → 0.47. */
function niceRound(n: number, decimals: number): number {
  if (n <= 0) return n;
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  const r = Math.round(n / mag) * mag;
  const f = 10 ** decimals;
  return Math.max(Math.round(r * f) / f, 1 / f);
}

/** An amount worth about `usd` US dollars in `currency`, nicely rounded; null without a rate. */
export function usdEquivalent(usd: number, currency: string): number | null {
  const v = convert(usd, 'USD', currency);
  if (v == null) return null;
  return niceRound(v, currencyByCode(currency)?.decimals ?? 2);
}

/**
 * Quick-pick amounts (top-ups, gift cards) sized for the currency: roughly
 * $5–$200 converted, so ₫ and Rp get sensible numbers too. Without rates, a
 * rough fallback by decimal places.
 */
export function presetAmounts(currency: string): number[] {
  const usd = [5, 10, 25, 50, 100, 200];
  const conv = usd.map(u => usdEquivalent(u, currency));
  if (conv.every((v): v is number => v != null)) return conv;
  return (currencyByCode(currency)?.decimals ?? 2) === 0
    ? [1000, 2500, 5000, 10000, 20000, 50000]
    : [10, 25, 50, 100, 200, 500];
}

/**
 * Parse a typed amount, keeping decimals in either style: "12.50" and "12,50"
 * are 12.5; "5,000" and "5.000" are 5000 (a separator followed by exactly three
 * digits is grouping). Stripping every non-digit turned €12.50 into €1,250.
 */
export function parseAmountInput(text: string, currency: string): number | null {
  const s = text.replace(/[^\d.,]/g, '');
  if (!s) return null;
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let n: number;
  if (lastSep === -1 || s.length - lastSep - 1 === 3) {
    n = Number(s.replace(/[.,]/g, ''));
  } else {
    n = Number(s.slice(0, lastSep).replace(/[.,]/g, '') + '.' + s.slice(lastSep + 1));
  }
  if (!Number.isFinite(n) || n <= 0) return null;
  const f = 10 ** (currencyByCode(currency)?.decimals ?? 2);
  return Math.round(n * f) / f;
}
