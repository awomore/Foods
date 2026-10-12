'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { LOCALES, LOCALE_INFO, switchLocalePath, type Locale } from '@/lib/i18n/config';
import { COUNTRIES, currencyFor } from '@/lib/geo';
import { regionName, useVisitor } from '@/lib/visitor';

type Labels = { label: string; country: string; language: string; done: string };

/**
 * The country + language chip. Language changes the URL (and sets Netlify's nf_lang
 * cookie so the homepage redirect remembers it); country only changes what the page
 * shows (prices, local time, the spotlight).
 */
export default function RegionPicker({
  lang,
  labels,
  tone = 'light',
  align = 'end',
  placement = 'below',
}: {
  lang: Locale;
  labels: Labels;
  tone?: 'light' | 'dark';
  align?: 'start' | 'end';
  placement?: 'below' | 'above';
}) {
  const { country, setCountry } = useVisitor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const countries = useMemo(
    () => COUNTRIES.map((cc) => [cc, regionName(cc, lang)] as const).sort((a, b) => a[1].localeCompare(b[1], lang)),
    [lang],
  );

  const changeLanguage = (to: Locale) => {
    try { document.cookie = `nf_lang=${to}; path=/; max-age=31536000; SameSite=Lax`; } catch {}
    window.location.assign(switchLocalePath(window.location.pathname, to) + window.location.hash);
  };

  const chip =
    tone === 'dark'
      ? 'border-cream/20 text-cream/80 hover:text-cream hover:border-cream/40'
      : 'border-border text-stone hover:text-ink hover:border-ink/30 bg-parchment/80';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={labels.label}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${chip}`}
      >
        <Globe size={14} aria-hidden />
        <span className="whitespace-nowrap">
          {country ? `${regionName(country, lang)} · ` : ''}
          {LOCALE_INFO[lang].native}
        </span>
        {country && <span className="font-mono text-[10.5px] opacity-60">{currencyFor(country)}</span>}
      </button>

      {open && (
        <div
          className={`absolute z-[60] w-[290px] card shadow-warm-lg p-4 space-y-4 ${align === 'end' ? 'end-0' : 'start-0'} ${
            placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          role="dialog"
          aria-label={labels.label}
        >
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-[0.08em] text-muted mb-1.5">{labels.country}</span>
            <select
              value={country ?? ''}
              onChange={(e) => e.target.value && setCountry(e.target.value)}
              className="w-full rounded-xl border border-border bg-parchment px-3 py-2 text-[14px] text-ink"
            >
              {!country && <option value="">—</option>}
              {countries.map(([cc, name]) => (
                <option key={cc} value={cc}>{name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-[0.08em] text-muted mb-1.5">{labels.language}</span>
            <select
              value={lang}
              onChange={(e) => changeLanguage(e.target.value as Locale)}
              className="w-full rounded-xl border border-border bg-parchment px-3 py-2 text-[14px] text-ink"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>{LOCALE_INFO[l].native}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setOpen(false)} className="btn-dark btn-sm w-full">
            {labels.done}
          </button>
        </div>
      )}
    </div>
  );
}
