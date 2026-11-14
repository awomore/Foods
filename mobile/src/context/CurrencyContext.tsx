import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useAuth } from './AuthContext';
import { parsePhoneCurrency, currencyByCode, type CurrencyInfo } from '../utils/currency';
import { setFxTable, setViewerCurrency, type FxTable } from '../utils/fx';
import { fxApi } from '../api/fx';

const OVERRIDE_KEY = '@currency_override_v1';
const FX_CACHE_KEY = '@fx_rates_v1';
const FX_REFRESH_MS = 6 * 60 * 60 * 1000;

/**
 * The VIEWER's currency is used for one thing only: the "≈" estimate shown
 * next to real prices. It never relabels an amount — an amount is always
 * shown in the currency of the record it came from (see fmtCurrency/fmtMoney).
 */
interface CurrencyContextValue {
  currency: CurrencyInfo;
  setCurrencyOverride: (info: CurrencyInfo | null) => Promise<void>;
  isOverridden: boolean;
  /** Bumps when exchange rates load, so consumers re-render with estimates. */
  fxVersion: number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function infoFor(code: string): CurrencyInfo {
  return currencyByCode(code) ?? { code, symbol: code, locale: 'en', decimals: 2 };
}

/** Phone number first (most reliable for where someone pays), then the phone's region, then USD. Never a naira default. */
function detectCurrency(phone: string | undefined | null): CurrencyInfo {
  const fromPhone = phone ? parsePhoneCurrency(phone) : null;
  if (fromPhone) return fromPhone;
  const deviceCode = getLocales()[0]?.currencyCode;
  if (deviceCode) return infoFor(deviceCode);
  return infoFor('USD');
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [override, setOverride] = useState<CurrencyInfo | null>(null);
  const [fxVersion, setFxVersion] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(OVERRIDE_KEY).then(v => {
      if (v) {
        try { setOverride(JSON.parse(v)); } catch {}
      }
    });
  }, []);

  // Exchange rates: cached copy first (instant estimates on launch), then the server.
  useEffect(() => {
    let cancelled = false;
    const apply = (t: FxTable) => { if (!cancelled) { setFxTable(t); setFxVersion(v => v + 1); } };

    AsyncStorage.getItem(FX_CACHE_KEY).then(raw => {
      if (!raw) return;
      try { apply(JSON.parse(raw)); } catch {}
    });

    const load = async () => {
      try {
        const res = await fxApi.rates();
        const t: FxTable = { rates: res.rates, fetchedAt: new Date(res.fetched_at).getTime() };
        apply(t);
        AsyncStorage.setItem(FX_CACHE_KEY, JSON.stringify(t)).catch(() => {});
      } catch {
        // No estimates until the next try; exact prices are unaffected.
      }
    };
    load();
    const id = setInterval(load, FX_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const detected = useMemo(() => detectCurrency(user?.phone), [user?.phone]);
  const currency = override ?? detected;

  useEffect(() => { setViewerCurrency(currency.code); setFxVersion(v => v + 1); }, [currency.code]);

  const setCurrencyOverride = useCallback(async (info: CurrencyInfo | null) => {
    if (info) {
      await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(info));
    } else {
      await AsyncStorage.removeItem(OVERRIDE_KEY);
    }
    setOverride(info);
  }, []);

  const value = useMemo(
    () => ({ currency, setCurrencyOverride, isOverridden: !!override, fxVersion }),
    [currency, setCurrencyOverride, override, fxVersion],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

/**
 * The currency a cook's own prices, sales and earnings are in — the cook's
 * profile currency, not the viewer's display preference. Falls back to the
 * phone's currency for sessions cached before the server sent it.
 */
export function useCookCurrency(): string {
  const { user } = useAuth();
  const { currency } = useCurrency();
  return user?.cook_currency ?? currency.code;
}
