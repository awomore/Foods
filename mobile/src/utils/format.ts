import i18n from 'i18next';
import { currencyByCode } from './currency';
import { uiLocale, fmtNumber } from '../i18n/locale';

// Per-currency display config — symbol, locale for number grouping, decimal places
const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; decimals: number }> = {
  NGN: { symbol: '₦',    locale: 'en-NG', decimals: 0 },
  KES: { symbol: 'KSh',  locale: 'en-KE', decimals: 0 },
  GHS: { symbol: 'GH₵',  locale: 'en-GH', decimals: 2 },
  ZAR: { symbol: 'R',    locale: 'en-ZA', decimals: 2 },
  EGP: { symbol: 'E£',   locale: 'en-EG', decimals: 2 },
  TZS: { symbol: 'TSh',  locale: 'en-TZ', decimals: 0 },
  UGX: { symbol: 'USh',  locale: 'en-UG', decimals: 0 },
  RWF: { symbol: 'FRw',  locale: 'en-RW', decimals: 0 },
  ETB: { symbol: 'Br',   locale: 'en-ET', decimals: 2 },
  ZMW: { symbol: 'ZK',   locale: 'en-ZM', decimals: 2 },
  GBP: { symbol: '£',    locale: 'en-GB', decimals: 2 },
  EUR: { symbol: '€',    locale: 'en-IE', decimals: 2 },
  USD: { symbol: '$',    locale: 'en-US', decimals: 2 },
  CAD: { symbol: 'CA$',  locale: 'en-CA', decimals: 2 },
  AUD: { symbol: 'A$',   locale: 'en-AU', decimals: 2 },
  NZD: { symbol: 'NZ$',  locale: 'en-NZ', decimals: 2 },
  CHF: { symbol: 'CHF',  locale: 'de-CH', decimals: 2 },
  NOK: { symbol: 'kr',   locale: 'nb-NO', decimals: 2 },
  SEK: { symbol: 'kr',   locale: 'sv-SE', decimals: 2 },
  DKK: { symbol: 'kr',   locale: 'da-DK', decimals: 2 },
  PLN: { symbol: 'zł',   locale: 'pl-PL', decimals: 2 },
  CZK: { symbol: 'Kč',   locale: 'cs-CZ', decimals: 2 },
  HUF: { symbol: 'Ft',   locale: 'hu-HU', decimals: 0 },
  RUB: { symbol: '₽',    locale: 'ru-RU', decimals: 2 },
  UAH: { symbol: '₴',    locale: 'uk-UA', decimals: 2 },
  TRY: { symbol: '₺',    locale: 'tr-TR', decimals: 2 },
  INR: { symbol: '₹',    locale: 'en-IN', decimals: 2 },
  PKR: { symbol: '₨',    locale: 'ur-PK', decimals: 0 },
  BDT: { symbol: '৳',    locale: 'bn-BD', decimals: 2 },
  JPY: { symbol: '¥',    locale: 'ja-JP', decimals: 0 },
  KRW: { symbol: '₩',    locale: 'ko-KR', decimals: 0 },
  CNY: { symbol: '¥',    locale: 'zh-CN', decimals: 2 },
  HKD: { symbol: 'HK$',  locale: 'zh-HK', decimals: 2 },
  SGD: { symbol: 'S$',   locale: 'en-SG', decimals: 2 },
  MYR: { symbol: 'RM',   locale: 'ms-MY', decimals: 2 },
  IDR: { symbol: 'Rp',   locale: 'id-ID', decimals: 0 },
  PHP: { symbol: '₱',    locale: 'en-PH', decimals: 2 },
  THB: { symbol: '฿',    locale: 'th-TH', decimals: 2 },
  VND: { symbol: '₫',    locale: 'vi-VN', decimals: 0 },
  AED: { symbol: 'AED',  locale: 'ar-AE', decimals: 2 },
  SAR: { symbol: 'SR',   locale: 'ar-SA', decimals: 2 },
  QAR: { symbol: 'QR',   locale: 'ar-QA', decimals: 2 },
  KWD: { symbol: 'KD',   locale: 'ar-KW', decimals: 3 },
  BHD: { symbol: 'BD',   locale: 'ar-BH', decimals: 3 },
  OMR: { symbol: 'OMR',  locale: 'ar-OM', decimals: 3 },
  ILS: { symbol: '₪',    locale: 'he-IL', decimals: 2 },
  BRL: { symbol: 'R$',   locale: 'pt-BR', decimals: 2 },
  MXN: { symbol: 'MX$',  locale: 'es-MX', decimals: 2 },
  COP: { symbol: '$',    locale: 'es-CO', decimals: 0 },
  XOF: { symbol: 'CFA',  locale: 'fr-SN', decimals: 0 },
  XAF: { symbol: 'FCFA', locale: 'fr-CM', decimals: 0 },
};

/** The symbol for an ISO code (for input labels like "Hourly rate (£)"), or the code itself. */
export function currencySymbol(currency: string): string {
  return (CURRENCY_CONFIG[currency] ?? currencyByCode(currency))?.symbol ?? currency;
}

// The currency is required: an amount means nothing without the currency of the
// record it came from (the order, the cook, the wallet). Defaulting it is how
// naira ended up on non-Nigerian users' screens.
export function fmtCurrency(amount: number, currency: string): string {
  const cfg = CURRENCY_CONFIG[currency] ?? currencyByCode(currency);
  if (!cfg) return `${currency} ${fmtNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Digits and separators follow the reader (₦5.000 for a German), the symbol follows the money.
  const n = fmtNumber(amount, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  });
  return cfg.symbol + n;
}

/** Round an amount to the precision the currency is shown and charged in (₦ whole, £ pence). */
export function roundMoney(amount: number, currency: string): number {
  const decimals = (CURRENCY_CONFIG[currency] ?? currencyByCode(currency))?.decimals ?? 2;
  const factor = 10 ** decimals;
  return Math.round(amount * factor) / factor;
}

/** A numeric date in the user's locale: 03/11/2026 in Nigeria, 11/3/2026 in the US, 2026/11/3 in Taiwan. */
export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(uiLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return i18n.t('time.just_now');
  if (diff < 3600) return i18n.t('time.minutes_ago', { n: Math.floor(diff / 60) });
  if (diff < 86400) return i18n.t('time.hours_ago', { n: Math.floor(diff / 3600) });
  if (diff < 604800) return i18n.t('time.days_ago', { n: Math.floor(diff / 86400) });
  return fmtDateShort(iso);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000 && d.getDate() === now.getDate()) return i18n.t('time.today');
  if (diff < 172_800_000) return i18n.t('time.yesterday');
  return fmtDateShort(iso);
}

export function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit' });
}

/** Generates a short human-readable order reference from a UUID */
export function shortOrderRef(uuid: string): string {
  const hex = uuid.replace(/-/g, '').toUpperCase();
  return `FOODS-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function pluralise(n: number, singular: string, plural = singular + 's'): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
