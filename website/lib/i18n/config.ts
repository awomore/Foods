// The languages the website ships in. Kept identical to the mobile app's 23 locales.

export const LOCALES = [
  'en', 'am', 'ar', 'bn', 'de', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko',
  'nl', 'pl', 'pt', 'ro', 'ru', 'sw', 'th', 'tr', 'uk', 'vi', 'zh',
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

type Script = 'jp' | 'kr' | 'sc' | 'arabic' | 'devanagari' | 'bengali' | 'thai' | 'ethiopic';

export const LOCALE_INFO: Record<Locale, { native: string; og: string; dir: 'ltr' | 'rtl'; script?: Script }> = {
  en: { native: 'English', og: 'en_US', dir: 'ltr' },
  am: { native: 'አማርኛ', og: 'am_ET', dir: 'ltr', script: 'ethiopic' },
  ar: { native: 'العربية', og: 'ar_AR', dir: 'rtl', script: 'arabic' },
  bn: { native: 'বাংলা', og: 'bn_BD', dir: 'ltr', script: 'bengali' },
  de: { native: 'Deutsch', og: 'de_DE', dir: 'ltr' },
  es: { native: 'Español', og: 'es_ES', dir: 'ltr' },
  fr: { native: 'Français', og: 'fr_FR', dir: 'ltr' },
  hi: { native: 'हिन्दी', og: 'hi_IN', dir: 'ltr', script: 'devanagari' },
  id: { native: 'Bahasa Indonesia', og: 'id_ID', dir: 'ltr' },
  it: { native: 'Italiano', og: 'it_IT', dir: 'ltr' },
  ja: { native: '日本語', og: 'ja_JP', dir: 'ltr', script: 'jp' },
  ko: { native: '한국어', og: 'ko_KR', dir: 'ltr', script: 'kr' },
  nl: { native: 'Nederlands', og: 'nl_NL', dir: 'ltr' },
  pl: { native: 'Polski', og: 'pl_PL', dir: 'ltr' },
  pt: { native: 'Português', og: 'pt_BR', dir: 'ltr' },
  ro: { native: 'Română', og: 'ro_RO', dir: 'ltr' },
  ru: { native: 'Русский', og: 'ru_RU', dir: 'ltr' },
  sw: { native: 'Kiswahili', og: 'sw_KE', dir: 'ltr' },
  th: { native: 'ไทย', og: 'th_TH', dir: 'ltr', script: 'thai' },
  tr: { native: 'Türkçe', og: 'tr_TR', dir: 'ltr' },
  uk: { native: 'Українська', og: 'uk_UA', dir: 'ltr' },
  vi: { native: 'Tiếng Việt', og: 'vi_VN', dir: 'ltr' },
  zh: { native: '简体中文', og: 'zh_CN', dir: 'ltr', script: 'sc' },
};

const SCRIPT_FONT: Record<Script, string> = {
  jp: 'Noto Sans JP',
  kr: 'Noto Sans KR',
  sc: 'Noto Sans SC',
  arabic: 'Noto Sans Arabic',
  devanagari: 'Noto Sans Devanagari',
  bengali: 'Noto Sans Bengali',
  thai: 'Noto Sans Thai',
  ethiopic: 'Noto Sans Ethiopic',
};

/** The Noto family a locale needs on top of the Latin/Cyrillic faces, if any. */
export const scriptFont = (lang: Locale): string | undefined => {
  const s = LOCALE_INFO[lang].script;
  return s ? SCRIPT_FONT[s] : undefined;
};

/** Path for a page in a language: localePath('de', '/fleet') → '/de/fleet'. */
export function localePath(lang: Locale, path: string): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${lang}${clean}`;
}

/** Swap the language segment of a path: '/de/fleet' → '/ja/fleet'. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split('/');
  if (parts[1] && isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join('/') || `/${to}`;
}
