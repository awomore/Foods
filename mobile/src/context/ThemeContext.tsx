import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as LightColors } from '../constants/theme';

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

function buildColors(accent: ThemeAccent): AppColors {
  return {
    ...LightColors,
    ember: accent.ember,
    spice: accent.spice,
    primary: accent.spice,
    leaf: accent.leaf,
    honey: accent.honey,
    healthBg: accent.healthBg,
    healthFg: accent.healthFg,
    successFg: accent.leaf,
    successBg: accent.healthBg,
    bgCook: accent.bgTint,
    cream: accent.bgTint,
    borderWarm: accent.borderTint,
  };
}

interface ThemeContextValue {
  accent: ThemeAccent;
  colors: AppColors;
  isDark: false;
  setAccent: (id: string) => void;
  setDarkOverride: (v: 'auto' | 'light' | 'dark') => void;
  darkOverride: 'light';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ACCENT_KEY = '@app_theme_accent';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<ThemeAccent>(THEME_PRESETS[0]);

  useEffect(() => {
    AsyncStorage.getItem(ACCENT_KEY).then(accentId => {
      if (accentId) {
        const preset = THEME_PRESETS.find(p => p.id === accentId);
        if (preset) setAccentState(preset);
      }
    });
  }, []);

  const setAccent = useCallback((id: string) => {
    const preset = THEME_PRESETS.find(p => p.id === id);
    if (!preset) return;
    setAccentState(preset);
    AsyncStorage.setItem(ACCENT_KEY, id);
  }, []);

  // Dark mode is permanently disabled — system dark maps to FOODS light theme
  const setDarkOverride = useCallback((_v: 'auto' | 'light' | 'dark') => {}, []);

  const colors = useMemo(() => buildColors(accent), [accent]);

  return (
    <ThemeContext.Provider value={{ accent, colors, isDark: false, setAccent, setDarkOverride, darkOverride: 'light' }}>
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
