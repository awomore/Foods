import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ar from './locales/ar.json';
import es from './locales/es.json';
import ha from './locales/ha.json';
import yo from './locales/yo.json';
import ig from './locales/ig.json';
import sw from './locales/sw.json';
import zh from './locales/zh.json';
import de from './locales/de.json';
import hi from './locales/hi.json';

export const STORAGE_KEY = '@foods_language';
export const RTL_LANGS = new Set(['ar', 'he', 'ur', 'fa', 'ps', 'dv', 'sd']);

export const SUPPORTED_LANGS: Record<string, { label: string; nativeLabel: string; rtl?: boolean }> = {
  en: { label: 'English', nativeLabel: 'English' },
  fr: { label: 'French', nativeLabel: 'Français' },
  pt: { label: 'Portuguese', nativeLabel: 'Português' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', rtl: true },
  es: { label: 'Spanish', nativeLabel: 'Español' },
  ha: { label: 'Hausa', nativeLabel: 'Hausa' },
  yo: { label: 'Yoruba', nativeLabel: 'Yorùbá' },
  ig: { label: 'Igbo', nativeLabel: 'Igbo' },
  sw: { label: 'Swahili', nativeLabel: 'Kiswahili' },
  zh: { label: 'Chinese', nativeLabel: '中文' },
  de: { label: 'German', nativeLabel: 'Deutsch' },
  hi: { label: 'Hindi', nativeLabel: 'हिन्दी' },
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    pt: { translation: pt },
    ar: { translation: ar },
    es: { translation: es },
    ha: { translation: ha },
    yo: { translation: yo },
    ig: { translation: ig },
    sw: { translation: sw },
    zh: { translation: zh },
    de: { translation: de },
    hi: { translation: hi },
  },
  lng: 'en',
  fallbackLng: 'en',
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
  const isRTL = RTL_LANGS.has(lang);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
    return true; // needs reload
  }
  return false;
}

export function getDeviceLang(): string {
  const locale = getLocales()[0]?.languageCode ?? 'en';
  return SUPPORTED_LANGS[locale] ? locale : 'en';
}

export default i18n;
