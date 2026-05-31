import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as LightColors } from '../constants/theme';

// --- Dark palette (warm, candlelit restaurant) ---
const DarkColors = {
  ink: '#F2EAE0',           // inverted: text becomes warm cream
  canvas: '#1C1208',        // inverted: background becomes deep warm brown
  ember: '#E8924A',
  spice: '#D4895A',

  bg: '#2E1E0C',
  bgCook: '#3A2614',
  bgCard: '#46301C',

  textInk: '#FAF4EC',
  body: '#DDD0BA',
  bodySoft: '#B8A08A',
  caps: '#8A7260',

  borderWarm: '#3E2C1C',

  leaf: '#52C068',
  stone: '#8A7460',         // placeholder text — visible on all dark surfaces

  successBg: '#162A1A',
  successFg: '#52C068',
  errorBg: '#2C1614',
  errorFg: '#E86050',
  warnBg: '#2C2010',
  warnFg: '#E8924A',
  infoBg: '#141C2C',
  infoFg: '#6090E8',
  healthBg: '#162A1A',
  healthFg: '#52C068',
  honey: '#2E2010',
  cream: '#281A0E',

  primary: '#D4895A',
  white: '#F2EAE0',
  black: '#1C1208',
};

// --- Theme accent presets (accent colours shared across light/dark) ---

export interface ThemeAccent {
  id: string;
  label: string;
  ember: string;
  spice: string;
  leaf: string;
  honey: string;
  honeyDark: string;         // dark-mode honey variant
  healthBg: string;
  healthBgDark: string;
  healthFg: string;
  bgTint: string;            // light mode tinted bg
  bgTintDark: string;        // dark mode tinted bg
  borderTint: string;
  borderTintDark: string;
}

export const THEME_PRESETS: ThemeAccent[] = [
  {
    id: 'warm',
    label: 'Warm (Default)',
    ember: '#E8924A',
    spice: '#B36A2E',
    leaf: '#2E8B3F',
    honey: '#FFF0C2',
    honeyDark: '#2E2410',
    healthBg: '#EDF4EE',
    healthBgDark: '#1A2E1E',
    healthFg: '#2A6640',
    bgTint: '#F5F0E8',
    bgTintDark: '#241A10',
    borderTint: '#E8DDD0',
    borderTintDark: '#3A2E22',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    ember: '#3B9EBE',
    spice: '#1E6E8E',
    leaf: '#2E8B7A',
    honey: '#C8EFFA',
    honeyDark: '#0E1E28',
    healthBg: '#EAF4F8',
    healthBgDark: '#0E1E28',
    healthFg: '#1E5E74',
    bgTint: '#EBF4FA',
    bgTintDark: '#0E1820',
    borderTint: '#B8D8EC',
    borderTintDark: '#1C3448',
  },
  {
    id: 'forest',
    label: 'Forest',
    ember: '#52A85C',
    spice: '#2E7A38',
    leaf: '#2E8B3F',
    honey: '#D4F0D8',
    honeyDark: '#0E200E',
    healthBg: '#EDF7EE',
    healthBgDark: '#0E200E',
    healthFg: '#1E5C28',
    bgTint: '#EBF5EC',
    bgTintDark: '#0E1A10',
    borderTint: '#B8D8BC',
    borderTintDark: '#1A3A1E',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    ember: '#8B6BE8',
    spice: '#5E3EB3',
    leaf: '#5B8BE8',
    honey: '#E8E4FF',
    honeyDark: '#1A1630',
    healthBg: '#EEF0FA',
    healthBgDark: '#1A1630',
    healthFg: '#3A2C8A',
    bgTint: '#EEEDF8',
    bgTintDark: '#1A1628',
    borderTint: '#D0CCEC',
    borderTintDark: '#302C50',
  },
  {
    id: 'rose',
    label: 'Rose',
    ember: '#E8608A',
    spice: '#B33060',
    leaf: '#B36080',
    honey: '#FFE4ED',
    honeyDark: '#2E1020',
    healthBg: '#FAECF2',
    healthBgDark: '#2E1020',
    healthFg: '#8A2048',
    bgTint: '#F8EAF0',
    bgTintDark: '#280E1A',
    borderTint: '#ECC8D8',
    borderTintDark: '#401828',
  },
];

export type AppColors = typeof LightColors;

function buildColors(accent: ThemeAccent, dark: boolean): AppColors {
  const base = dark ? DarkColors : LightColors;
  return {
    ...base,
    ember: accent.ember,
    spice: dark ? accent.spice.replace(/^#/, '') === base.spice.replace(/^#/, '') ? accent.ember : accent.spice : accent.spice,
    primary: dark ? accent.ember : accent.spice,
    leaf: accent.leaf,
    honey: dark ? accent.honeyDark : accent.honey,
    healthBg: dark ? accent.healthBgDark : accent.healthBg,
    healthFg: accent.healthFg,
    successFg: accent.leaf,
    successBg: dark ? accent.healthBgDark : accent.healthBg,
    bgCook: dark ? accent.bgTintDark : accent.bgTint,
    cream: dark ? accent.bgTintDark : accent.bgTint,
    borderWarm: dark ? accent.borderTintDark : accent.borderTint,
  };
}

interface ThemeContextValue {
  accent: ThemeAccent;
  colors: AppColors;
  isDark: boolean;
  setAccent: (id: string) => void;
  setDarkOverride: (v: 'auto' | 'light' | 'dark') => void;
  darkOverride: 'auto' | 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ACCENT_KEY = '@app_theme_accent';
const DARK_KEY = '@app_theme_dark';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [accent, setAccentState] = useState<ThemeAccent>(THEME_PRESETS[0]);
  const [darkOverride, setDarkOverrideState] = useState<'auto' | 'light' | 'dark'>('auto');

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(ACCENT_KEY),
      AsyncStorage.getItem(DARK_KEY),
    ]).then(([accentId, darkVal]) => {
      if (accentId) {
        const preset = THEME_PRESETS.find(p => p.id === accentId);
        if (preset) setAccentState(preset);
      }
      if (darkVal === 'light' || darkVal === 'dark' || darkVal === 'auto') {
        setDarkOverrideState(darkVal);
      }
    });
  }, []);

  const isDark = darkOverride === 'auto'
    ? systemScheme === 'dark'
    : darkOverride === 'dark';

  const setAccent = useCallback((id: string) => {
    const preset = THEME_PRESETS.find(p => p.id === id);
    if (!preset) return;
    setAccentState(preset);
    AsyncStorage.setItem(ACCENT_KEY, id);
  }, []);

  const setDarkOverride = useCallback((v: 'auto' | 'light' | 'dark') => {
    setDarkOverrideState(v);
    AsyncStorage.setItem(DARK_KEY, v);
  }, []);

  const colors = useMemo(() => buildColors(accent, isDark), [accent, isDark]);

  return (
    <ThemeContext.Provider value={{ accent, colors, isDark, setAccent, setDarkOverride, darkOverride }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useColors(): AppColors {
  return useTheme().colors;
}

export function useIsDark(): boolean {
  return useTheme().isDark;
}
