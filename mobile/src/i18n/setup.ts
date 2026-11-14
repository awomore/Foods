import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18nManager, Platform, Settings } from 'react-native';

import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import es from './locales/es.json';
import sw from './locales/sw.json';
import zh from './locales/zh.json';
import zhHant from './locales/zh-Hant.json';
import de from './locales/de.json';
import hi from './locales/hi.json';
import ru from './locales/ru.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import tr from './locales/tr.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import id from './locales/id.json';
import pl from './locales/pl.json';
import ro from './locales/ro.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import am from './locales/am.json';
import bn from './locales/bn.json';

export const STORAGE_KEY = '@foods_language';
export const RTL_LANGS = new Set(['ar', 'he', 'ur', 'fa', 'ps', 'dv', 'sd']);

export const SUPPORTED_LANGS: Record<string, { label: string; nativeLabel: string; rtl?: boolean }> = {
  en: { label: 'English', nativeLabel: 'English' },
  fr: { label: 'French', nativeLabel: 'Français' },
  pt: { label: 'Portuguese', nativeLabel: 'Português' },
  es: { label: 'Spanish', nativeLabel: 'Español' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', rtl: true },
  ru: { label: 'Russian', nativeLabel: 'Русский' },
  zh: { label: 'Chinese (Simplified)', nativeLabel: '简体中文' },
  'zh-Hant': { label: 'Chinese (Traditional)', nativeLabel: '繁體中文' },
  hi: { label: 'Hindi', nativeLabel: 'हिन्दी' },
  de: { label: 'German', nativeLabel: 'Deutsch' },
  it: { label: 'Italian', nativeLabel: 'Italiano' },
  nl: { label: 'Dutch', nativeLabel: 'Nederlands' },
  tr: { label: 'Turkish', nativeLabel: 'Türkçe' },
  ja: { label: 'Japanese', nativeLabel: '日本語' },
  ko: { label: 'Korean', nativeLabel: '한국어' },
  id: { label: 'Indonesian', nativeLabel: 'Bahasa Indonesia' },
  pl: { label: 'Polish', nativeLabel: 'Polski' },
  ro: { label: 'Romanian', nativeLabel: 'Română' },
  uk: { label: 'Ukrainian', nativeLabel: 'Українська' },
  vi: { label: 'Vietnamese', nativeLabel: 'Tiếng Việt' },
  th: { label: 'Thai', nativeLabel: 'ภาษาไทย' },
  sw: { label: 'Swahili', nativeLabel: 'Kiswahili' },
  am: { label: 'Amharic', nativeLabel: 'አማርኛ' },
  bn: { label: 'Bengali', nativeLabel: 'বাংলা' },
};

/** Chinese in Taiwan, Hong Kong or Macao, or any Traditional-script tag (zh-Hant-*), reads Traditional. */
const TRADITIONAL_REGIONS = new Set(['TW', 'HK', 'MO']);

export function getDeviceLang(): string {
  const device = getLocales()[0];
  const code = device?.languageCode ?? 'en';
  if (code === 'zh') {
    const tag = device?.languageTag ?? '';
    const traditional = /Hant/i.test(tag) || (!/Hans/i.test(tag) && TRADITIONAL_REGIONS.has(device?.regionCode ?? ''));
    return traditional ? 'zh-Hant' : 'zh';
  }
  return SUPPORTED_LANGS[code] ? code : 'en';
}

// Start in the phone's language, so even the language picker is readable before a choice is saved.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    pt: { translation: pt },
    es: { translation: es },
    ar: { translation: ar },
    ru: { translation: ru },
    zh: { translation: zh },
    'zh-Hant': { translation: zhHant },
    hi: { translation: hi },
    de: { translation: de },
    it: { translation: it },
    nl: { translation: nl },
    tr: { translation: tr },
    ja: { translation: ja },
    ko: { translation: ko },
    id: { translation: id },
    pl: { translation: pl },
    ro: { translation: ro },
    uk: { translation: uk },
    vi: { translation: vi },
    th: { translation: th },
    sw: { translation: sw },
    am: { translation: am },
    bn: { translation: bn },
  },
  lng: getDeviceLang(),
  fallbackLng: { 'zh-Hant': ['en'], default: ['en'] },
  load: 'currentOnly',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export async function loadSavedLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function applyLanguage(lang: string) {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
  // iOS writes permission prompts (location, camera…) from the app bundle's
  // localisation, chosen at launch from AppleLanguages — the phone's language,
  // not this setting. Recording the choice there makes the next launch's
  // prompts match the app (a German tester got English prompts in a German UI).
  if (Platform.OS === 'ios') {
    try { Settings.set({ AppleLanguages: [lang] }); } catch { /* non-fatal */ }
  }
  const isRTL = RTL_LANGS.has(lang);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
    return true; // needs reload
  }
  return false;
}

export default i18n;
