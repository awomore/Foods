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

// Pure-white system: surfaces are always white/neutral; presets only vary the
// accent hue. Success stays green across every theme. Dark-mode fields are
// retained for type-compatibility but unused (dark mode is disabled).
const NEUTRAL_SURFACES = {
  leaf: '#16A34A',
  healthBg: '#F0FDF4',
  healthBgDark: '#F0FDF4',
  healthFg: '#15803D',
  bgTint: '#F5F5F5',
  bgTintDark: '#F5F5F5',
  borderTint: '#E5E7EB',
  borderTintDark: '#E5E7EB',
};

export const THEME_PRESETS: ThemeAccent[] = [
  {
    id: 'warm',
    label: 'Sunset (Default)',
    ember: '#FF8A5C',
    spice: '#FF6B35',
    honey: '#FFF1EB',
    honeyDark: '#FFF1EB',
    ...NEUTRAL_SURFACES,
  },
  {
    id: 'ocean',
    label: 'Ocean',
    ember: '#3B9EBE',
    spice: '#0E7490',
    honey: '#ECFEFF',
    honeyDark: '#ECFEFF',
    ...NEUTRAL_SURFACES,
  },
  {
    id: 'forest',
    label: 'Forest',
    ember: '#52A85C',
    spice: '#15803D',
    honey: '#F0FDF4',
    honeyDark: '#F0FDF4',
    ...NEUTRAL_SURFACES,
  },
  {
    id: 'midnight',
    label: 'Violet',
    ember: '#8B6BE8',
    spice: '#6D28D9',
    honey: '#F5F3FF',
    honeyDark: '#F5F3FF',
    ...NEUTRAL_SURFACES,
  },
  {
    id: 'rose',
    label: 'Rose',
    ember: '#F472A0',
    spice: '#DB2777',
    honey: '#FDF2F8',
    honeyDark: '#FDF2F8',
    ...NEUTRAL_SURFACES,
  },
];

export type AppColors = typeof LightColors;


interface ThemeContextValue {
  accent: ThemeAccent;
  colors: AppColors;
  isDark: false;
  setAccent: (id: string) => void;
  setBrandColor: (hex: string | null) => void;
  setDarkOverride: (v: 'auto' | 'light' | 'dark') => void;
  darkOverride: 'light';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ACCENT_KEY = '@app_theme_accent';
const BRAND_COLOR_KEY = '@brand_primary_color';

function buildColorsWithBrand(accent: ThemeAccent, brandPrimary: string | null): AppColors {
  const spice = brandPrimary ?? accent.spice;
  const ember = brandPrimary ?? accent.ember;
  return {
    ...LightColors,
    ember,
    spice,
    primary: spice,
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<ThemeAccent>(THEME_PRESETS[0]);
  const [brandColor, setBrandColorState] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(ACCENT_KEY),
      AsyncStorage.getItem(BRAND_COLOR_KEY),
    ]).then(([accentId, saved]) => {
      if (accentId) {
        const preset = THEME_PRESETS.find(p => p.id === accentId);
        if (preset) setAccentState(preset);
      }
      if (saved) setBrandColorState(saved);
    });
  }, []);

  const setAccent = useCallback((id: string) => {
    const preset = THEME_PRESETS.find(p => p.id === id);
    if (!preset) return;
    setAccentState(preset);
    AsyncStorage.setItem(ACCENT_KEY, id);
  }, []);

  const setBrandColor = useCallback((hex: string | null) => {
    setBrandColorState(hex);
    if (hex) AsyncStorage.setItem(BRAND_COLOR_KEY, hex);
    else AsyncStorage.removeItem(BRAND_COLOR_KEY);
  }, []);

  // Dark mode is permanently disabled — system dark maps to FOODS light theme
  const setDarkOverride = useCallback((_v: 'auto' | 'light' | 'dark') => {}, []);

  const colors = useMemo(() => buildColorsWithBrand(accent, brandColor), [accent, brandColor]);

  return (
    <ThemeContext.Provider value={{ accent, colors, isDark: false, setAccent, setBrandColor, setDarkOverride, darkOverride: 'light' }}>
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
