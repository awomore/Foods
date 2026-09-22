'use strict';

// A cook prices in one currency, and every money row they own (dishes, courses,
// products, invoices, bookings…) inherits it. Nothing used to write
// cook_profiles.currency_code, so every cook — London or Lagos — sat on the
// column's 'NGN' default. The cook's currency is now defaulted from their phone's
// calling code at onboarding (and editable there), and inserts read it from here.

const DEFAULT_CURRENCY = 'NGN';

// Calling code → ISO-4217. Mirrors CALLING_CODE_MAP in mobile/src/utils/currency.ts
// so the currency a cook is shown in onboarding is the one the server would pick.
const CALLING_CODES = [
  ['+234', 'NGN'], ['+254', 'KES'], ['+233', 'GHS'], ['+27', 'ZAR'], ['+20', 'EGP'],
  ['+255', 'TZS'], ['+256', 'UGX'], ['+250', 'RWF'], ['+251', 'ETB'], ['+260', 'ZMW'],
  ['+264', 'NAD'], ['+265', 'MWK'], ['+267', 'BWP'], ['+258', 'MZN'], ['+263', 'USD'],
  ['+252', 'USD'], ['+231', 'LRD'], ['+232', 'SLL'], ['+230', 'MUR'], ['+248', 'SCR'],
  ['+244', 'AOA'], ['+243', 'CDF'], ['+221', 'XOF'], ['+225', 'XOF'], ['+226', 'XOF'],
  ['+227', 'XOF'], ['+228', 'XOF'], ['+229', 'XOF'], ['+220', 'GMD'], ['+237', 'XAF'],
  ['+236', 'XAF'], ['+235', 'XAF'], ['+241', 'XAF'], ['+242', 'XAF'], ['+240', 'XAF'],
  ['+44', 'GBP'], ['+353', 'EUR'], ['+33', 'EUR'], ['+49', 'EUR'], ['+34', 'EUR'], ['+39', 'EUR'],
  ['+31', 'EUR'], ['+32', 'EUR'], ['+351', 'EUR'], ['+358', 'EUR'], ['+370', 'EUR'],
  ['+371', 'EUR'], ['+372', 'EUR'], ['+356', 'EUR'], ['+357', 'EUR'], ['+386', 'EUR'],
  ['+421', 'EUR'], ['+47', 'NOK'], ['+46', 'SEK'], ['+45', 'DKK'], ['+354', 'ISK'], ['+41', 'CHF'],
  ['+48', 'PLN'], ['+420', 'CZK'], ['+36', 'HUF'], ['+380', 'UAH'], ['+381', 'RSD'],
  ['+359', 'BGN'], ['+40', 'RON'], ['+7', 'RUB'], ['+375', 'BYN'], ['+373', 'MDL'],
  ['+374', 'AMD'], ['+995', 'GEL'], ['+994', 'AZN'], ['+1', 'USD'], ['+52', 'MXN'],
  ['+506', 'CRC'], ['+507', 'PAB'], ['+503', 'USD'], ['+504', 'HNL'], ['+505', 'NIO'],
  ['+502', 'GTQ'], ['+501', 'BZD'], ['+509', 'HTG'], ['+1876', 'JMD'], ['+1868', 'TTD'],
  ['+1246', 'BBD'], ['+1784', 'XCD'], ['+55', 'BRL'], ['+54', 'ARS'], ['+57', 'COP'],
  ['+56', 'CLP'], ['+51', 'PEN'], ['+58', 'VES'], ['+591', 'BOB'], ['+592', 'GYD'],
  ['+595', 'PYG'], ['+598', 'UYU'], ['+597', 'SRD'], ['+91', 'INR'], ['+92', 'PKR'],
  ['+880', 'BDT'], ['+94', 'LKR'], ['+977', 'NPR'], ['+81', 'JPY'], ['+82', 'KRW'], ['+86', 'CNY'],
  ['+852', 'HKD'], ['+853', 'MOP'], ['+886', 'TWD'], ['+65', 'SGD'], ['+60', 'MYR'],
  ['+62', 'IDR'], ['+63', 'PHP'], ['+66', 'THB'], ['+84', 'VND'], ['+855', 'KHR'], ['+856', 'LAK'],
  ['+95', 'MMK'], ['+975', 'BTN'], ['+960', 'MVR'], ['+992', 'TJS'], ['+993', 'TMT'],
  ['+996', 'KGS'], ['+998', 'UZS'], ['+976', 'MNT'], ['+971', 'AED'], ['+966', 'SAR'],
  ['+974', 'QAR'], ['+965', 'KWD'], ['+973', 'BHD'], ['+968', 'OMR'], ['+972', 'ILS'],
  ['+961', 'LBP'], ['+962', 'JOD'], ['+964', 'IQD'], ['+967', 'YER'], ['+90', 'TRY'],
  ['+61', 'AUD'], ['+64', 'NZD'], ['+679', 'FJD'], ['+675', 'PGK'],
].sort((a, b) => b[0].length - a[0].length); // longest prefix first: +1876 before +1

/**
 * Currency for a phone number, or null when the number carries no recognisable
 * calling code. Local-format numbers ("0802…") have none, so they return null
 * and callers fall back to DEFAULT_CURRENCY — the platform's home market.
 */
function currencyForPhone(phone) {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '');
  if (!digits || digits.startsWith('0')) return null;
  const e164 = digits.startsWith('+') ? digits : '+' + digits;
  for (const [prefix, code] of CALLING_CODES) {
    if (e164.startsWith(prefix)) return code;
  }
  return null;
}

/** A client-supplied currency, upper-cased, or null if it isn't ISO-4217-shaped. */
function normalizeCurrency(code) {
  const c = String(code ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** The currency a cook prices in. Pass the transaction's sql when inside one. */
async function cookCurrency(sql, cookId) {
  if (!cookId) return DEFAULT_CURRENCY;
  const rows = await sql`SELECT currency_code FROM cook_profiles WHERE id = ${cookId}`;
  return rows[0]?.currency_code ?? DEFAULT_CURRENCY;
}

module.exports = { DEFAULT_CURRENCY, CALLING_CODES, currencyForPhone, normalizeCurrency, cookCurrency };
