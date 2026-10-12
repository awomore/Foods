// Country ↔ currency ↔ time-zone data used to localise prices and the country spotlight.
// Pure data and functions only, safe to import from server and client code.

const CURRENCY_TABLE =
  'AD:EUR,AE:AED,AF:AFN,AG:XCD,AI:XCD,AL:ALL,AM:AMD,AO:AOA,AR:ARS,AS:USD,AT:EUR,AU:AUD,AW:AWG,AX:EUR,AZ:AZN,' +
  'BA:BAM,BB:BBD,BD:BDT,BE:EUR,BF:XOF,BG:BGN,BH:BHD,BI:BIF,BJ:XOF,BM:BMD,BN:BND,BO:BOB,BR:BRL,BS:BSD,BT:BTN,' +
  'BW:BWP,BY:BYN,BZ:BZD,CA:CAD,CD:CDF,CF:XAF,CG:XAF,CH:CHF,CI:XOF,CK:NZD,CL:CLP,CM:XAF,CN:CNY,CO:COP,CR:CRC,' +
  'CU:CUP,CV:CVE,CW:ANG,CY:EUR,CZ:CZK,DE:EUR,DJ:DJF,DK:DKK,DM:XCD,DO:DOP,DZ:DZD,EC:USD,EE:EUR,EG:EGP,ER:ERN,' +
  'ES:EUR,ET:ETB,FI:EUR,FJ:FJD,FM:USD,FO:DKK,FR:EUR,GA:XAF,GB:GBP,GD:XCD,GE:GEL,GF:EUR,GG:GBP,GH:GHS,GI:GIP,' +
  'GL:DKK,GM:GMD,GN:GNF,GP:EUR,GQ:XAF,GR:EUR,GT:GTQ,GU:USD,GW:XOF,GY:GYD,HK:HKD,HN:HNL,HR:EUR,HT:HTG,HU:HUF,' +
  'ID:IDR,IE:EUR,IL:ILS,IM:GBP,IN:INR,IQ:IQD,IR:IRR,IS:ISK,IT:EUR,JE:GBP,JM:JMD,JO:JOD,JP:JPY,KE:KES,KG:KGS,' +
  'KH:KHR,KI:AUD,KM:KMF,KN:XCD,KR:KRW,KW:KWD,KY:KYD,KZ:KZT,LA:LAK,LB:LBP,LC:XCD,LI:CHF,LK:LKR,LR:LRD,LS:LSL,' +
  'LT:EUR,LU:EUR,LV:EUR,LY:LYD,MA:MAD,MC:EUR,MD:MDL,ME:EUR,MG:MGA,MH:USD,MK:MKD,ML:XOF,MM:MMK,MN:MNT,MO:MOP,' +
  'MQ:EUR,MR:MRU,MT:EUR,MU:MUR,MV:MVR,MW:MWK,MX:MXN,MY:MYR,MZ:MZN,NA:NAD,NC:XPF,NE:XOF,NG:NGN,NI:NIO,NL:EUR,' +
  'NO:NOK,NP:NPR,NR:AUD,NZ:NZD,OM:OMR,PA:PAB,PE:PEN,PF:XPF,PG:PGK,PH:PHP,PK:PKR,PL:PLN,PR:USD,PS:ILS,PT:EUR,' +
  'PW:USD,PY:PYG,QA:QAR,RE:EUR,RO:RON,RS:RSD,RU:RUB,RW:RWF,SA:SAR,SB:SBD,SC:SCR,SD:SDG,SE:SEK,SG:SGD,SI:EUR,' +
  'SK:EUR,SL:SLE,SM:EUR,SN:XOF,SO:SOS,SR:SRD,SS:SSP,ST:STN,SV:USD,SZ:SZL,TC:USD,TD:XAF,TG:XOF,TH:THB,TJ:TJS,' +
  'TL:USD,TM:TMT,TN:TND,TO:TOP,TR:TRY,TT:TTD,TV:AUD,TW:TWD,TZ:TZS,UA:UAH,UG:UGX,US:USD,UY:UYU,UZ:UZS,VA:EUR,' +
  'VC:XCD,VE:VES,VG:USD,VI:USD,VN:VND,VU:VUV,WS:WST,XK:EUR,YE:YER,YT:EUR,ZA:ZAR,ZM:ZMW,ZW:USD';

export const COUNTRY_CURRENCY: Record<string, string> = Object.fromEntries(
  CURRENCY_TABLE.split(',').map((p) => p.split(':') as [string, string]),
);

/** Every country a visitor can pick, as ISO 3166-1 alpha-2 codes. */
export const COUNTRIES = Object.keys(COUNTRY_CURRENCY);

export const currencyFor = (cc?: string | null) => (cc && COUNTRY_CURRENCY[cc]) || 'USD';

// Rough units per US dollar. Only used to turn the example prices on the page into
// believable local numbers; never for anything a customer pays.
const PER_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.78, CHF: 0.88, CAD: 1.37, AUD: 1.52, NZD: 1.65, JPY: 150, CNY: 7.2, HKD: 7.8,
  TWD: 32, KRW: 1380, SGD: 1.33, MYR: 4.6, THB: 34, IDR: 16000, PHP: 57, VND: 25000, INR: 84, PKR: 280,
  BDT: 120, LKR: 300, NPR: 134, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.385,
  JOD: 0.71, ILS: 3.7, TRY: 34, EGP: 49, MAD: 9.9, TND: 3.1, DZD: 134, NGN: 1550, GHS: 15.5, KES: 129,
  UGX: 3700, TZS: 2700, RWF: 1350, ETB: 120, ZAR: 18, XOF: 600, XAF: 600, ZMW: 26, MZN: 64, BWP: 13.5,
  NAD: 18, MUR: 46, SEK: 10.5, NOK: 10.7, DKK: 6.9, PLN: 3.9, CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8,
  RSD: 108, UAH: 41, RUB: 92, KZT: 480, GEL: 2.7, AMD: 390, AZN: 1.7, MXN: 19, BRL: 5.5, ARS: 950,
  CLP: 930, COP: 4100, PEN: 3.75, UYU: 40, DOP: 60, JMD: 157, TTD: 6.8, GTQ: 7.8, CRC: 520, ISK: 138,
};

/** Currencies people quote with cents. Everything else is shown as whole units. */
const CENTS = new Set(['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'SGD', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'ILS', 'MYR', 'BRL', 'PEN', 'PLN', 'RON', 'BGN', 'TND']);

function niceRound(x: number, currency: string): number {
  if (CENTS.has(currency)) return Math.round(x * 2) / 2;
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 1));
  return Math.round(x / step) * step;
}

/**
 * Convert an example amount in US dollars into a round local figure.
 * Falls back to dollars when we have no rough rate for the currency.
 */
export function exampleAmount(usd: number, currency: string): { amount: number; currency: string } {
  const rate = PER_USD[currency];
  if (!rate) return { amount: niceRound(usd, 'USD'), currency: 'USD' };
  return { amount: niceRound(usd * rate, currency), currency };
}

export function formatMoney(amount: number, currency: string, locale: string): string {
  const cents = CENTS.has(currency) ? 2 : 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: cents, maximumFractionDigits: cents }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** A representative time zone per country, for showing local time when we only know the country. */
export const COUNTRY_TZ: Record<string, string> = {
  NG: 'Africa/Lagos', GH: 'Africa/Accra', KE: 'Africa/Nairobi', ZA: 'Africa/Johannesburg', EG: 'Africa/Cairo',
  MA: 'Africa/Casablanca', ET: 'Africa/Addis_Ababa', TZ: 'Africa/Dar_es_Salaam', UG: 'Africa/Kampala',
  RW: 'Africa/Kigali', SN: 'Africa/Dakar', CI: 'Africa/Abidjan', CM: 'Africa/Douala', DZ: 'Africa/Algiers',
  TN: 'Africa/Tunis', ZM: 'Africa/Lusaka', ZW: 'Africa/Harare', GB: 'Europe/London', IE: 'Europe/Dublin',
  DE: 'Europe/Berlin', AT: 'Europe/Vienna', CH: 'Europe/Zurich', FR: 'Europe/Paris', NL: 'Europe/Amsterdam',
  BE: 'Europe/Brussels', ES: 'Europe/Madrid', PT: 'Europe/Lisbon', IT: 'Europe/Rome', SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo', DK: 'Europe/Copenhagen', FI: 'Europe/Helsinki', PL: 'Europe/Warsaw', CZ: 'Europe/Prague',
  HU: 'Europe/Budapest', RO: 'Europe/Bucharest', GR: 'Europe/Athens', TR: 'Europe/Istanbul', UA: 'Europe/Kyiv',
  RU: 'Europe/Moscow', US: 'America/New_York', CA: 'America/Toronto', MX: 'America/Mexico_City',
  BR: 'America/Sao_Paulo', AR: 'America/Argentina/Buenos_Aires', CL: 'America/Santiago', CO: 'America/Bogota',
  PE: 'America/Lima', AE: 'Asia/Dubai', SA: 'Asia/Riyadh', QA: 'Asia/Qatar', IL: 'Asia/Jerusalem',
  IN: 'Asia/Kolkata', PK: 'Asia/Karachi', BD: 'Asia/Dhaka', LK: 'Asia/Colombo', NP: 'Asia/Kathmandu',
  JP: 'Asia/Tokyo', KR: 'Asia/Seoul', CN: 'Asia/Shanghai', HK: 'Asia/Hong_Kong', TW: 'Asia/Taipei',
  SG: 'Asia/Singapore', MY: 'Asia/Kuala_Lumpur', ID: 'Asia/Jakarta', TH: 'Asia/Bangkok', VN: 'Asia/Ho_Chi_Minh',
  PH: 'Asia/Manila', AU: 'Australia/Sydney', NZ: 'Pacific/Auckland',
};

// Extra zones that map to a country (fallback detection only; the site prefers edge geolocation).
const TZ_EXTRA: Record<string, string> = {
  'Asia/Calcutta': 'IN', 'Asia/Saigon': 'VN', 'Europe/Kiev': 'UA', 'Europe/Busingen': 'DE',
  'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US',
  'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Detroit': 'US', 'America/Vancouver': 'CA',
  'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/St_Johns': 'CA',
  'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU',
  'America/Monterrey': 'MX', 'America/Tijuana': 'MX', 'America/Fortaleza': 'BR', 'America/Manaus': 'BR',
  'Asia/Shanghai': 'CN', 'Asia/Makassar': 'ID', 'Europe/Belfast': 'GB', 'Atlantic/Canary': 'ES',
};

/** Best-effort country from the browser alone: time zone first, then the language tag's region. */
export function guessCountry(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byTz = Object.keys(COUNTRY_TZ).find((cc) => COUNTRY_TZ[cc] === tz) || TZ_EXTRA[tz];
    if (byTz) return byTz;
    for (const tag of navigator.languages ?? [navigator.language]) {
      const region = tag.split('-')[1]?.toUpperCase();
      if (region && COUNTRY_CURRENCY[region]) return region;
    }
  } catch {}
  return null;
}
