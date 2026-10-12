'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dict } from '@/lib/i18n/dict';
import { LOCALE_INFO, type Locale } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/rich';
import { COUNTRIES, COUNTRY_TZ, currencyFor, exampleAmount, formatMoney } from '@/lib/geo';
import { formatLocale, regionName, useMounted, useVisitor } from '@/lib/visitor';
import { AppBadges } from '@/components/site/AppBadges';

/** The visitor's country, in the spotlight. Nigeria is just another country here. */
export default function CountrySpotlight({
  lang,
  t,
  badges,
  countryLabel,
}: {
  lang: Locale;
  t: Dict['home']['spot'];
  badges: Dict['common']['appBadges'];
  countryLabel: string;
}) {
  const { country, ready, setCountry } = useVisitor();
  const mounted = useMounted();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const countries = useMemo(
    () => COUNTRIES.map((cc) => [cc, regionName(cc, lang)] as const).sort((a, b) => a[1].localeCompare(b[1], lang)),
    [lang],
  );

  const name = country ? regionName(country, lang) : null;
  const locale = formatLocale(lang, country);
  const tz = country ? COUNTRY_TZ[country] : undefined;
  const currency = currencyFor(country);
  const price = exampleAmount(18, currency);

  const facts: [string, string][] = [
    [t.fLang, LOCALE_INFO[lang].native],
    [t.fPrice, formatMoney(price.amount, price.currency, locale)],
    [t.fDate, now ? safe(() => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).format(now)) : '—'],
    [t.fTime, now ? safe(() => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(now)) : '—'],
  ];

  return (
    <section className="bg-ink text-cream py-[clamp(64px,9vw,120px)]">
      <div className="container-x">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-cream/60">{t.kicker}</p>
        <div className="mt-5 grid lg:grid-cols-[1.3fr_1fr] gap-[clamp(36px,5vw,88px)] items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <h2 className="font-serif font-bold text-[clamp(3.2rem,10vw,9.25rem)] leading-[0.9] tracking-[-0.04em] [overflow-wrap:anywhere] min-h-[0.9em]">
                {ready ? name ?? '—' : <span className="text-cream/30">{t.detecting}</span>}
              </h2>
              {ready && name && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[#14532D] px-3 py-1 font-mono text-[11.5px] text-[#4ADE80]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" aria-hidden />
                  {t.live}
                </span>
              )}
            </div>
            {ready && name && <p className="mt-6 max-w-[30em] text-[clamp(1.05rem,1.6vw,1.25rem)] font-light">{fmt(t.line, { country: name })}</p>}
            <AppBadges variant="inverse" t={badges} className="mt-7" />
          </div>

          <div>
            <p className="mb-3 font-mono text-[11.5px] uppercase tracking-[0.08em] text-cream/60">{t.factsTitle}</p>
            <dl className="border-t border-[#262626]">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-[#262626] py-3.5">
                  <dt className="text-[14px] text-cream/60">{k}</dt>
                  <dd className="m-0 min-w-0 text-end text-[clamp(1.05rem,1.6vw,1.3rem)] font-medium tabular-nums" suppressHydrationWarning>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-[clamp(40px,5vw,64px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[#262626] pt-5 text-[14px] text-cream/60">
          <span>{t.change}</span>
          <label className="flex items-center gap-2.5">
            <span>{countryLabel}</span>
            <select
              value={country ?? ''}
              onChange={(e) => e.target.value && setCountry(e.target.value)}
              className="max-w-[60vw] rounded-lg border border-[#262626] bg-ink px-2.5 py-1.5 text-cream [color-scheme:dark]"
            >
              {!country && <option value="">—</option>}
              {/* Country names differ between ICU versions, so the list is filled in the browser only. */}
              {mounted && countries.map(([cc, n]) => (
                <option key={cc} value={cc}>{n}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}

function safe(f: () => string): string {
  try { return f(); } catch { return '—'; }
}
