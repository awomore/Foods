/**
 * money.js — minor-unit money value type.
 *
 * Money is represented as an integer count of the currency's minor unit
 * (kobo for NGN, cents for USD, …) plus an ISO-4217 alpha-3 currency code.
 * Storing integers avoids the float drift that NUMERIC(x,2) columns and JS
 * `parseFloat` arithmetic accumulate over many wallet operations.
 *
 * This is the JS half of Phase 2 of the payments architecture (see
 * memory/payments_architecture.md). The DB half lives in migration
 * 047_wallet_money_minor.sql, which adds `*_minor BIGINT` + `currency CHAR(3)`
 * columns alongside the legacy `_ngn` columns during the dual-write window.
 *
 * NOTE: the `postgres` driver returns BIGINT (int8) as a JS *string* to avoid
 * precision loss beyond Number.MAX_SAFE_INTEGER. `fromMinor` accepts strings so
 * values read straight out of a `*_minor` column work without manual coercion.
 */

'use strict';

const DEFAULT_CURRENCY = 'NGN';

// ISO-4217 exponent (number of decimal places in the major unit). Extend as
// new currencies come online with a connector; unknown codes throw rather than
// silently assuming 2 and corrupting amounts.
const EXPONENTS = Object.freeze({
  NGN: 2,
  USD: 2,
  GBP: 2,
  EUR: 2,
  KES: 2,
  GHS: 2,
  ZAR: 2,
});

function exponentOf(currency) {
  const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
  const exp = EXPONENTS[code];
  if (exp === undefined) throw new Error(`money: unknown currency "${currency}"`);
  return exp;
}

/**
 * Convert a major-unit amount (e.g. naira) to integer minor units (kobo).
 * Accepts numbers or numeric strings. Rounds to the nearest minor unit.
 * @returns {number} integer minor-unit amount
 */
function toMinor(major, currency = DEFAULT_CURRENCY) {
  const n = typeof major === 'string' ? Number(major) : major;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`money.toMinor: invalid amount "${major}"`);
  }
  const factor = 10 ** exponentOf(currency);
  return Math.round(n * factor);
}

/**
 * Convert integer minor units (kobo) back to a major-unit Number (naira).
 * Accepts numbers or numeric strings (BIGINT columns arrive as strings).
 * @returns {number} major-unit amount
 */
function fromMinor(minor, currency = DEFAULT_CURRENCY) {
  const n = typeof minor === 'string' ? Number(minor) : minor;
  if (!Number.isInteger(n)) {
    throw new Error(`money.fromMinor: minor amount must be an integer, got "${minor}"`);
  }
  const factor = 10 ** exponentOf(currency);
  return n / factor;
}

/**
 * Build a plain money value object.
 * @returns {{ amount_minor: number, currency: string }}
 */
function money(amount_minor, currency = DEFAULT_CURRENCY) {
  if (!Number.isInteger(amount_minor)) {
    throw new Error(`money: amount_minor must be an integer, got "${amount_minor}"`);
  }
  return { amount_minor, currency: String(currency).toUpperCase() };
}

module.exports = { toMinor, fromMinor, money, exponentOf, DEFAULT_CURRENCY, EXPONENTS };
