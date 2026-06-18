export interface CurrencyInfo {
  code: string;
  symbol: string;
  locale: string;
  decimals: number;
}

// Ordered longest-prefix first so +234 matches before +23, etc.
// Each entry is [callingCode, CurrencyInfo]
const CALLING_CODE_MAP: Array<[string, CurrencyInfo]> = [
  // ── Africa ──────────────────────────────────────────────────────────────
  ['+234', { code: 'NGN', symbol: '₦',    locale: 'en-NG', decimals: 0 }],
  ['+254', { code: 'KES', symbol: 'KSh',  locale: 'en-KE', decimals: 0 }],
  ['+233', { code: 'GHS', symbol: 'GH₵',  locale: 'en-GH', decimals: 2 }],
  ['+27',  { code: 'ZAR', symbol: 'R',    locale: 'en-ZA', decimals: 2 }],
  ['+20',  { code: 'EGP', symbol: 'E£',   locale: 'en-EG', decimals: 2 }],
  ['+255', { code: 'TZS', symbol: 'TSh',  locale: 'en-TZ', decimals: 0 }],
  ['+256', { code: 'UGX', symbol: 'USh',  locale: 'en-UG', decimals: 0 }],
  ['+250', { code: 'RWF', symbol: 'FRw',  locale: 'en-RW', decimals: 0 }],
  ['+251', { code: 'ETB', symbol: 'Br',   locale: 'en-ET', decimals: 2 }],
  ['+260', { code: 'ZMW', symbol: 'ZK',   locale: 'en-ZM', decimals: 2 }],
  ['+264', { code: 'NAD', symbol: 'N$',   locale: 'en-NA', decimals: 2 }],
  ['+265', { code: 'MWK', symbol: 'MK',   locale: 'en-MW', decimals: 2 }],
  ['+267', { code: 'BWP', symbol: 'P',    locale: 'en-BW', decimals: 2 }],
  ['+258', { code: 'MZN', symbol: 'MT',   locale: 'pt-MZ', decimals: 2 }],
  ['+263', { code: 'USD', symbol: '$',    locale: 'en-US', decimals: 2 }], // Zimbabwe
  ['+252', { code: 'USD', symbol: '$',    locale: 'en-US', decimals: 2 }], // Somalia (often USD)
  ['+231', { code: 'LRD', symbol: 'L$',   locale: 'en-LR', decimals: 2 }],
  ['+232', { code: 'SLL', symbol: 'Le',   locale: 'en-SL', decimals: 0 }],
  ['+230', { code: 'MUR', symbol: 'Rs',   locale: 'en-MU', decimals: 2 }],
  ['+248', { code: 'SCR', symbol: 'SR',   locale: 'en-SC', decimals: 2 }],
  ['+244', { code: 'AOA', symbol: 'Kz',   locale: 'pt-AO', decimals: 2 }],
  ['+243', { code: 'CDF', symbol: 'FC',   locale: 'fr-CD', decimals: 2 }],
  // West Africa CFA (XOF)
  ['+221', { code: 'XOF', symbol: 'CFA',  locale: 'fr-SN', decimals: 0 }],
  ['+225', { code: 'XOF', symbol: 'CFA',  locale: 'fr-CI', decimals: 0 }],
  ['+226', { code: 'XOF', symbol: 'CFA',  locale: 'fr-BF', decimals: 0 }],
  ['+227', { code: 'XOF', symbol: 'CFA',  locale: 'fr-NE', decimals: 0 }],
  ['+228', { code: 'XOF', symbol: 'CFA',  locale: 'fr-TG', decimals: 0 }],
  ['+229', { code: 'XOF', symbol: 'CFA',  locale: 'fr-BJ', decimals: 0 }],
  ['+220', { code: 'GMD', symbol: 'D',    locale: 'en-GM', decimals: 2 }],
  // Central Africa CFA (XAF)
  ['+237', { code: 'XAF', symbol: 'FCFA', locale: 'fr-CM', decimals: 0 }],
  ['+236', { code: 'XAF', symbol: 'FCFA', locale: 'fr-CF', decimals: 0 }],
  ['+235', { code: 'XAF', symbol: 'FCFA', locale: 'fr-TD', decimals: 0 }],
  ['+241', { code: 'XAF', symbol: 'FCFA', locale: 'fr-GA', decimals: 0 }],
  ['+242', { code: 'XAF', symbol: 'FCFA', locale: 'fr-CG', decimals: 0 }],
  ['+240', { code: 'XAF', symbol: 'FCFA', locale: 'es-GQ', decimals: 0 }],

  // ── Europe ───────────────────────────────────────────────────────────────
  ['+44',  { code: 'GBP', symbol: '£',    locale: 'en-GB', decimals: 2 }],
  ['+353', { code: 'EUR', symbol: '€',    locale: 'en-IE', decimals: 2 }],
  ['+33',  { code: 'EUR', symbol: '€',    locale: 'fr-FR', decimals: 2 }],
  ['+49',  { code: 'EUR', symbol: '€',    locale: 'de-DE', decimals: 2 }],
  ['+34',  { code: 'EUR', symbol: '€',    locale: 'es-ES', decimals: 2 }],
  ['+39',  { code: 'EUR', symbol: '€',    locale: 'it-IT', decimals: 2 }],
  ['+31',  { code: 'EUR', symbol: '€',    locale: 'nl-NL', decimals: 2 }],
  ['+32',  { code: 'EUR', symbol: '€',    locale: 'fr-BE', decimals: 2 }],
  ['+351', { code: 'EUR', symbol: '€',    locale: 'pt-PT', decimals: 2 }],
  ['+358', { code: 'EUR', symbol: '€',    locale: 'fi-FI', decimals: 2 }],
  ['+370', { code: 'EUR', symbol: '€',    locale: 'lt-LT', decimals: 2 }],
  ['+371', { code: 'EUR', symbol: '€',    locale: 'lv-LV', decimals: 2 }],
  ['+372', { code: 'EUR', symbol: '€',    locale: 'et-EE', decimals: 2 }],
  ['+356', { code: 'EUR', symbol: '€',    locale: 'mt-MT', decimals: 2 }],
  ['+357', { code: 'EUR', symbol: '€',    locale: 'el-CY', decimals: 2 }],
  ['+386', { code: 'EUR', symbol: '€',    locale: 'sl-SI', decimals: 2 }],
  ['+421', { code: 'EUR', symbol: '€',    locale: 'sk-SK', decimals: 2 }],
  ['+47',  { code: 'NOK', symbol: 'kr',   locale: 'nb-NO', decimals: 2 }],
  ['+46',  { code: 'SEK', symbol: 'kr',   locale: 'sv-SE', decimals: 2 }],
  ['+45',  { code: 'DKK', symbol: 'kr',   locale: 'da-DK', decimals: 2 }],
  ['+354', { code: 'ISK', symbol: 'kr',   locale: 'is-IS', decimals: 0 }],
  ['+41',  { code: 'CHF', symbol: 'CHF',  locale: 'de-CH', decimals: 2 }],
  ['+48',  { code: 'PLN', symbol: 'zł',   locale: 'pl-PL', decimals: 2 }],
  ['+420', { code: 'CZK', symbol: 'Kč',   locale: 'cs-CZ', decimals: 2 }],
  ['+36',  { code: 'HUF', symbol: 'Ft',   locale: 'hu-HU', decimals: 0 }],
  ['+380', { code: 'UAH', symbol: '₴',    locale: 'uk-UA', decimals: 2 }],
  ['+381', { code: 'RSD', symbol: 'din',  locale: 'sr-RS', decimals: 2 }],
  ['+359', { code: 'BGN', symbol: 'лв',   locale: 'bg-BG', decimals: 2 }],
  ['+40',  { code: 'RON', symbol: 'lei',  locale: 'ro-RO', decimals: 2 }],
  ['+7',   { code: 'RUB', symbol: '₽',    locale: 'ru-RU', decimals: 2 }],
  ['+375', { code: 'BYN', symbol: 'Br',   locale: 'be-BY', decimals: 2 }],
  ['+373', { code: 'MDL', symbol: 'L',    locale: 'ro-MD', decimals: 2 }],
  ['+374', { code: 'AMD', symbol: '֏',    locale: 'hy-AM', decimals: 0 }],
  ['+995', { code: 'GEL', symbol: '₾',    locale: 'ka-GE', decimals: 2 }],
  ['+994', { code: 'AZN', symbol: '₼',    locale: 'az-AZ', decimals: 2 }],

  // ── North America ─────────────────────────────────────────────────────────
  ['+1',   { code: 'USD', symbol: '$',    locale: 'en-US', decimals: 2 }],
  ['+52',  { code: 'MXN', symbol: 'MX$',  locale: 'es-MX', decimals: 2 }],
  ['+506', { code: 'CRC', symbol: '₡',    locale: 'es-CR', decimals: 0 }],
  ['+507', { code: 'PAB', symbol: 'B/.',  locale: 'es-PA', decimals: 2 }],
  ['+503', { code: 'USD', symbol: '$',    locale: 'en-US', decimals: 2 }], // El Salvador
  ['+504', { code: 'HNL', symbol: 'L',    locale: 'es-HN', decimals: 2 }],
  ['+505', { code: 'NIO', symbol: 'C$',   locale: 'es-NI', decimals: 2 }],
  ['+502', { code: 'GTQ', symbol: 'Q',    locale: 'es-GT', decimals: 2 }],
  ['+501', { code: 'BZD', symbol: 'BZ$',  locale: 'en-BZ', decimals: 2 }],
  ['+509', { code: 'HTG', symbol: 'G',    locale: 'ht-HT', decimals: 2 }],

  // ── Caribbean ─────────────────────────────────────────────────────────────
  ['+1876', { code: 'JMD', symbol: 'J$',  locale: 'en-JM', decimals: 2 }],
  ['+1868', { code: 'TTD', symbol: 'TT$', locale: 'en-TT', decimals: 2 }],
  ['+1246', { code: 'BBD', symbol: 'Bds$',locale: 'en-BB', decimals: 2 }],
  ['+1784', { code: 'XCD', symbol: 'EC$', locale: 'en-VC', decimals: 2 }],

  // ── South America ─────────────────────────────────────────────────────────
  ['+55',  { code: 'BRL', symbol: 'R$',   locale: 'pt-BR', decimals: 2 }],
  ['+54',  { code: 'ARS', symbol: '$',    locale: 'es-AR', decimals: 2 }],
  ['+57',  { code: 'COP', symbol: '$',    locale: 'es-CO', decimals: 0 }],
  ['+56',  { code: 'CLP', symbol: '$',    locale: 'es-CL', decimals: 0 }],
  ['+51',  { code: 'PEN', symbol: 'S/',   locale: 'es-PE', decimals: 2 }],
  ['+58',  { code: 'VES', symbol: 'Bs.S', locale: 'es-VE', decimals: 2 }],
  ['+591', { code: 'BOB', symbol: 'Bs.',  locale: 'es-BO', decimals: 2 }],
  ['+592', { code: 'GYD', symbol: 'G$',   locale: 'en-GY', decimals: 2 }],
  ['+595', { code: 'PYG', symbol: '₲',    locale: 'es-PY', decimals: 0 }],
  ['+598', { code: 'UYU', symbol: '$U',   locale: 'es-UY', decimals: 2 }],
  ['+597', { code: 'SRD', symbol: '$',    locale: 'nl-SR', decimals: 2 }],

  // ── Asia ─────────────────────────────────────────────────────────────────
  ['+91',  { code: 'INR', symbol: '₹',    locale: 'en-IN', decimals: 2 }],
  ['+92',  { code: 'PKR', symbol: '₨',    locale: 'ur-PK', decimals: 0 }],
  ['+880', { code: 'BDT', symbol: '৳',    locale: 'bn-BD', decimals: 2 }],
  ['+94',  { code: 'LKR', symbol: 'Rs',   locale: 'si-LK', decimals: 2 }],
  ['+977', { code: 'NPR', symbol: 'Rs',   locale: 'ne-NP', decimals: 2 }],
  ['+81',  { code: 'JPY', symbol: '¥',    locale: 'ja-JP', decimals: 0 }],
  ['+82',  { code: 'KRW', symbol: '₩',    locale: 'ko-KR', decimals: 0 }],
  ['+86',  { code: 'CNY', symbol: '¥',    locale: 'zh-CN', decimals: 2 }],
  ['+852', { code: 'HKD', symbol: 'HK$',  locale: 'zh-HK', decimals: 2 }],
  ['+853', { code: 'MOP', symbol: 'P',    locale: 'zh-MO', decimals: 2 }],
  ['+886', { code: 'TWD', symbol: 'NT$',  locale: 'zh-TW', decimals: 0 }],
  ['+65',  { code: 'SGD', symbol: 'S$',   locale: 'en-SG', decimals: 2 }],
  ['+60',  { code: 'MYR', symbol: 'RM',   locale: 'ms-MY', decimals: 2 }],
  ['+62',  { code: 'IDR', symbol: 'Rp',   locale: 'id-ID', decimals: 0 }],
  ['+63',  { code: 'PHP', symbol: '₱',    locale: 'en-PH', decimals: 2 }],
  ['+66',  { code: 'THB', symbol: '฿',    locale: 'th-TH', decimals: 2 }],
  ['+84',  { code: 'VND', symbol: '₫',    locale: 'vi-VN', decimals: 0 }],
  ['+855', { code: 'KHR', symbol: '៛',    locale: 'km-KH', decimals: 0 }],
  ['+856', { code: 'LAK', symbol: '₭',    locale: 'lo-LA', decimals: 0 }],
  ['+95',  { code: 'MMK', symbol: 'K',    locale: 'my-MM', decimals: 0 }],
  ['+975', { code: 'BTN', symbol: 'Nu',   locale: 'dz-BT', decimals: 2 }],
  ['+960', { code: 'MVR', symbol: 'Rf',   locale: 'dv-MV', decimals: 2 }],
  ['+992', { code: 'TJS', symbol: 'SM',   locale: 'tg-TJ', decimals: 2 }],
  ['+993', { code: 'TMT', symbol: 'T',    locale: 'tk-TM', decimals: 2 }],
  ['+996', { code: 'KGS', symbol: 'лв',   locale: 'ky-KG', decimals: 2 }],
  ['+998', { code: 'UZS', symbol: 'лв',   locale: 'uz-UZ', decimals: 0 }],
  ['+976', { code: 'MNT', symbol: '₮',    locale: 'mn-MN', decimals: 0 }],

  // ── Middle East ───────────────────────────────────────────────────────────
  ['+971', { code: 'AED', symbol: 'AED',  locale: 'ar-AE', decimals: 2 }],
  ['+966', { code: 'SAR', symbol: 'SR',   locale: 'ar-SA', decimals: 2 }],
  ['+974', { code: 'QAR', symbol: 'QR',   locale: 'ar-QA', decimals: 2 }],
  ['+965', { code: 'KWD', symbol: 'KD',   locale: 'ar-KW', decimals: 3 }],
  ['+973', { code: 'BHD', symbol: 'BD',   locale: 'ar-BH', decimals: 3 }],
  ['+968', { code: 'OMR', symbol: 'OMR',  locale: 'ar-OM', decimals: 3 }],
  ['+972', { code: 'ILS', symbol: '₪',    locale: 'he-IL', decimals: 2 }],
  ['+961', { code: 'LBP', symbol: 'LL',   locale: 'ar-LB', decimals: 0 }],
  ['+962', { code: 'JOD', symbol: 'JD',   locale: 'ar-JO', decimals: 3 }],
  ['+964', { code: 'IQD', symbol: 'IQD',  locale: 'ar-IQ', decimals: 0 }],
  ['+967', { code: 'YER', symbol: '﷼',    locale: 'ar-YE', decimals: 0 }],
  ['+90',  { code: 'TRY', symbol: '₺',    locale: 'tr-TR', decimals: 2 }],

  // ── Oceania ───────────────────────────────────────────────────────────────
  ['+61',  { code: 'AUD', symbol: 'A$',   locale: 'en-AU', decimals: 2 }],
  ['+64',  { code: 'NZD', symbol: 'NZ$',  locale: 'en-NZ', decimals: 2 }],
  ['+679', { code: 'FJD', symbol: 'FJ$',  locale: 'en-FJ', decimals: 2 }],
  ['+675', { code: 'PGK', symbol: 'K',    locale: 'en-PG', decimals: 2 }],
];

// Sort longest prefix first so +1876 matches before +1
const SORTED_MAP = CALLING_CODE_MAP.sort((a, b) => b[0].length - a[0].length);

export const DEFAULT_CURRENCY: CurrencyInfo = {
  code: 'NGN', symbol: '₦', locale: 'en-NG', decimals: 0,
};

export function parsePhoneCurrency(phone: string): CurrencyInfo {
  if (!phone) return DEFAULT_CURRENCY;
  const normalized = phone.startsWith('+') ? phone : '+' + phone;
  for (const [prefix, info] of SORTED_MAP) {
    if (normalized.startsWith(prefix)) return info;
  }
  return DEFAULT_CURRENCY;
}

export function formatAmount(amount: number, info: CurrencyInfo): string {
  const n = Number(amount).toLocaleString(info.locale, {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  });
  return info.symbol + n;
}
