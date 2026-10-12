'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { COUNTRY_CURRENCY, guessCountry } from './geo';

// Where the visitor is. The real answer comes from the Netlify edge function at /api/geo
// (IP geolocation); the browser's time zone is the fallback. A country the visitor picks
// themselves wins over both and is remembered on this device.

type Visitor = {
  country: string | null;
  city: string | null;
  /** True once detection has finished, so components can avoid flashing a default. */
  ready: boolean;
  setCountry: (cc: string) => void;
};

const VisitorContext = createContext<Visitor>({ country: null, city: null, ready: false, setCountry: () => {} });

const OVERRIDE_KEY = 'foods-country';

export function VisitorProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let saved: string | null = null;
    try { saved = localStorage.getItem(OVERRIDE_KEY); } catch {}
    if (saved && COUNTRY_CURRENCY[saved]) {
      setCountryState(saved);
      setReady(true);
      return;
    }

    const done = (cc: string | null, ct: string | null) => {
      if (cancelled) return;
      setCountryState(cc && COUNTRY_CURRENCY[cc] ? cc : guessCountry());
      setCity(ct);
      setReady(true);
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    fetch('/api/geo', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { country?: string | null; city?: string | null }) => done(d.country ?? null, d.city ?? null))
      .catch(() => done(null, null))
      .finally(() => clearTimeout(timer));

    return () => { cancelled = true; ctrl.abort(); };
  }, []);

  const setCountry = (cc: string) => {
    setCountryState(cc);
    setCity(null); // a picked country has no reliable city
    try { localStorage.setItem(OVERRIDE_KEY, cc); } catch {}
  };

  return <VisitorContext.Provider value={{ country, city, ready, setCountry }}>{children}</VisitorContext.Provider>;
}

export const useVisitor = () => useContext(VisitorContext);

/** Localised country name, e.g. regionName('DE', 'ja') → 'ドイツ'. */
export function regionName(cc: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** False during the server render and the first client render; true after hydration. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

// English-speaking regions that have their own English number/date conventions in CLDR.
const ENGLISH_REGIONS = new Set(['US', 'GB', 'IE', 'AU', 'NZ', 'CA', 'NG', 'GH', 'KE', 'ZA', 'IN', 'SG', 'PH', 'JM', 'TT', 'UG', 'TZ', 'RW', 'ZM', 'ZW', 'BW', 'MW', 'SL', 'LR', 'GM', 'MT', 'PK', 'HK']);

/**
 * The locale for formatting numbers, money and dates: the page language with the visitor's
 * region (de-AT → "€ 16,50"). English pages outside English-speaking countries use en-GB,
 * so an English reader in Germany sees "12.4K", not "12,4K".
 */
export function formatLocale(lang: string, country: string | null): string {
  if (!country) return lang;
  if (lang === 'en') return ENGLISH_REGIONS.has(country) ? `en-${country}` : 'en-GB';
  return `${lang}-${country}`;
}
