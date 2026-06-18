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

export function fmtCurrency(amount: number, currency = 'NGN'): string {
  const cfg = CURRENCY_CONFIG[currency];
  if (!cfg) return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const n = Number(amount).toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  });
  return cfg.symbol + n;
}

/** Format a date ISO string as dd-mm-yyyy */
export function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDateShort(iso);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172_800_000) return 'Yesterday';
  return fmtDateShort(iso);
}

export function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

/** Generates a short human-readable order reference from a UUID */
export function shortOrderRef(uuid: string): string {
  const hex = uuid.replace(/-/g, '').toUpperCase();
  return `FOODS-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function pluralise(n: number, singular: string, plural = singular + 's'): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
