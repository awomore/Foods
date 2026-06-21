import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { I18nManager } from 'react-native';
import '../i18n/setup';
import i18n, { applyLanguage, loadSavedLanguage, RTL_LANGS, SUPPORTED_LANGS, STORAGE_KEY } from '../i18n/setup';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocaleContextValue {
  language: string;
  isRTL: boolean;
  isSelected: boolean;
  changeLanguage: (lang: string) => Promise<{ needsReload: boolean }>;
}

const LocaleContext = createContext<LocaleContextValue>({
  language: 'en',
  isRTL: false,
  isSelected: false,
  changeLanguage: async () => ({ needsReload: false }),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState(i18n.language ?? 'en');
  const [isSelected, setIsSelected] = useState(false);
  const isRTL = RTL_LANGS.has(language);

  useEffect(() => {
    loadSavedLanguage().then(saved => {
      if (saved) {
        i18n.changeLanguage(saved);
        setLanguage(saved);
        setIsSelected(true);
      }
    });
  }, []);

  const changeLanguage = useCallback(async (lang: string) => {
    const needsReload = await applyLanguage(lang);
    setLanguage(lang);
    setIsSelected(true);
    return { needsReload };
  }, []);

  return (
    <LocaleContext.Provider value={{ language, isRTL, isSelected, changeLanguage }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export async function hasLanguageBeenSelected(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEY);
    return val !== null;
  } catch {
    return false;
  }
}
