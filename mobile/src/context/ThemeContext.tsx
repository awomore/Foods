import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as BaseColors } from '../constants/theme';

export interface ThemeAccent {
  id: string;
  label: string;
  ember: string;
  spice: string;
  leaf: string;
  honey: string;
  healthBg: string;
  healthFg: string;
  bgTint: string;     // subtle tinted background (replaces bgCook / cream)
  borderTint: string; // subtle border color (replaces borderWarm)
}

export const THEME_PRESETS: ThemeAccent[] = [
  {
    id: 'warm',
    label: 'Warm (Default)',
    ember: '#E8924A',
    spice: '#B36A2E',
    leaf: '#2E8B3F',
    honey: '#FFF0C2',
    healthBg: '#EDF4EE',
    healthFg: '#2A6640',
    bgTint: '#F5F0E8',
    borderTint: '#E8DDD0',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    ember: '#3B9EBE',
    spice: '#1E6E8E',
    leaf: '#2E8B7A',
    honey: '#C8EFFA',
    healthBg: '#EAF4F8',
    healthFg: '#1E5E74',
    bgTint: '#EBF4FA',
    borderTint: '#B8D8EC',
  },
  {
    id: 'forest',
    label: 'Forest',
    ember: '#52A85C',
    spice: '#2E7A38',
    leaf: '#2E8B3F',
    honey: '#D4F0D8',
    healthBg: '#EDF7EE',
    healthFg: '#1E5C28',
    bgTint: '#EBF5EC',
    borderTint: '#B8D8BC',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    ember: '#8B6BE8',
    spice: '#5E3EB3',
    leaf: '#5B8BE8',
    honey: '#E8E4FF',
    healthBg: '#EEF0FA',
    healthFg: '#3A2C8A',
    bgTint: '#EEEDF8',
    borderTint: '#D0CCEC',
  },
  {
    id: 'rose',
    label: 'Rose',
    ember: '#E8608A',
    spice: '#B33060',
    leaf: '#B36080',
    honey: '#FFE4ED',
    healthBg: '#FAECF2',
    healthFg: '#8A2048',
    bgTint: '#F8EAF0',
    borderTint: '#ECC8D8',
  },
];

export type AppColors = typeof BaseColors;

function buildColors(accent: ThemeAccent): AppColors {
  return {
    ...BaseColors,
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
  setAccent: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = '@app_theme_accent';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<ThemeAccent>(THEME_PRESETS[0]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(id => {
      if (id) {
        const preset = THEME_PRESETS.find(p => p.id === id);
        if (preset) setAccentState(preset);
      }
    });
  }, []);

  const setAccent = useCallback((id: string) => {
    const preset = THEME_PRESETS.find(p => p.id === id);
    if (!preset) return;
    setAccentState(preset);
    AsyncStorage.setItem(STORAGE_KEY, id);
  }, []);

  const colors = useMemo(() => buildColors(accent), [accent]);

  return (
    <ThemeContext.Provider value={{ accent, colors, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Drop-in replacement for importing Colors — reactive to theme changes */
export function useColors(): AppColors {
  return useTheme().colors;
}
