import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { parsePhoneCurrency, formatAmount, type CurrencyInfo } from '../utils/currency';

const OVERRIDE_KEY = '@currency_override_v1';

interface CurrencyContextValue {
  currency: CurrencyInfo;
  fmt: (amount: number) => string;
  setCurrencyOverride: (info: CurrencyInfo | null) => Promise<void>;
  isOverridden: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [override, setOverride] = useState<CurrencyInfo | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(OVERRIDE_KEY).then(v => {
      if (v) {
        try { setOverride(JSON.parse(v)); } catch {}
      }
    });
  }, []);

  const phoneCurrency = useMemo(() => parsePhoneCurrency(user?.phone ?? ''), [user?.phone]);
  const currency = useMemo(() => override ?? phoneCurrency, [override, phoneCurrency]);
  const fmt = useCallback((amount: number) => formatAmount(amount, currency), [currency]);

  const setCurrencyOverride = useCallback(async (info: CurrencyInfo | null) => {
    if (info) {
      await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(info));
    } else {
      await AsyncStorage.removeItem(OVERRIDE_KEY);
    }
    setOverride(info);
  }, []);

  const value = useMemo(
    () => ({ currency, fmt, setCurrencyOverride, isOverridden: !!override }),
    [currency, fmt, setCurrencyOverride, override],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
