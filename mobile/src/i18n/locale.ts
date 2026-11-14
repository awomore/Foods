import i18n from 'i18next';
import { getLocales } from 'expo-localization';

/**
 * The BCP-47 locale every date, time and number on screen is formatted with:
 * the app's language, refined by the phone's region where they agree.
 *
 * Never hardcode a locale such as 'en-NG' in a screen — that is how a
 * German or Taiwanese user ended up with Nigerian dates and English month
 * names. English on a Nigerian phone still resolves to en-NG (dd/mm/yyyy);
 * English on a US phone resolves to en-US.
 */
export function uiLocale(): string {
  const lang = i18n.language || 'en';
  const device = getLocales()[0];
  const region = device?.regionCode ?? undefined;

  if (lang === 'zh-Hant') {
    return region && ['TW', 'HK', 'MO'].includes(region) ? `zh-Hant-${region}` : 'zh-Hant-TW';
  }
  if (lang === 'zh') return 'zh-Hans-CN';

  // The phone's region picks the date order: fr-CA vs fr-FR, en-NG vs en-US.
  // Unusual pairs like en-DE are valid and give that region's conventions.
  return region ? `${lang}-${region}` : lang;
}

/** "Mon" / "Mo." / "周一" — never a hand-written English day list. */
export function fmtWeekdayShort(d: Date): string {
  return d.toLocaleDateString(uiLocale(), { weekday: 'short' });
}

/** Day and month for chart axes: 3/11 in the UK, 11/3 in the US, 3.11. in Germany. */
export function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString(uiLocale(), { day: 'numeric', month: 'numeric' });
}

/** Clock time in the locale's own style: 2:30 PM, 14:30, 下午2:30. */
export function fmtClock(d: Date, withMinutes = true): string {
  return d.toLocaleTimeString(uiLocale(), withMinutes ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' });
}

/** Thousands separators and decimals in the user's locale. */
export function fmtNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  try {
    return Number(n).toLocaleString(uiLocale(), opts);
  } catch {
    return Number(n).toLocaleString('en', opts);
  }
}
