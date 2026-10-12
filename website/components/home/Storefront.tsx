'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
import type { Dict } from '@/lib/i18n/dict';
import { fmt, rich } from '@/lib/i18n/rich';
import { currencyFor, exampleAmount, formatMoney } from '@/lib/geo';
import { formatLocale, useVisitor } from '@/lib/visitor';

// Example menu, priced in dollars and shown in the visitor's own currency and format.
const ITEMS = [
  { img: 'ramen', usd: 18 },
  { img: 'sushi2', usd: 24 },
  { img: 'curry', usd: 15 },
];

export default function Storefront({ lang, t }: { lang: string; t: Dict['home']['store'] }) {
  const { country } = useVisitor();
  const currency = currencyFor(country);
  const locale = formatLocale(lang, country);
  const followers = safe(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(12400), '12.4K');
  const time = safe(() => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2026, 9, 18, 10, 0)), '10:00');

  return (
    <section className="bg-warm py-[clamp(64px,9vw,120px)]">
      <div className="container-x grid lg:grid-cols-2 gap-[clamp(40px,6vw,96px)] items-center">
        <div className="min-w-0">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">{t.kicker}</p>
          <h2 className="mt-3 font-serif font-bold text-[clamp(2.1rem,4.4vw,3.75rem)] leading-none tracking-[-0.035em] text-ink text-balance">
            {rich(t.title)}
          </h2>
          <p className="mt-5 max-w-[30em] text-stone">{t.body}</p>
          <ul className="mt-8 grid sm:grid-cols-2 border-t border-border">
            {t.ways.map((w) => (
              <li key={w} className="flex items-center gap-2.5 border-b border-border py-3.5 text-[15.5px] font-medium text-ink">
                <span className="h-[7px] w-[7px] flex-shrink-0 rounded-[2px] bg-spice" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[22px] bg-parchment shadow-[0_1px_2px_#0000000F,0_24px_60px_-12px_#00000026]">
          <span className="absolute end-3 top-3 z-10 rounded bg-black/70 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.05em] text-cream">
            {t.example}
          </span>
          <Image src="/images/home/sushi.jpg" alt="" width={900} height={420} className="aspect-[900/420] w-full object-cover" />
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 pt-3 pb-4">
            <div className="-mt-9 grid h-16 w-16 place-items-center rounded-full border-4 border-parchment bg-spice font-serif text-[28px] font-bold text-cream" aria-hidden>
              H
            </div>
            <div className="min-w-0">
              <p className="font-serif text-[19px] font-semibold tracking-[-0.01em] text-ink" dir="ltr">Hana’s Table</p>
              <p className="text-[13px] text-muted">
                <span dir="ltr">@hanastable</span> · <b className="font-semibold text-ink tabular-nums" suppressHydrationWarning>{followers}</b> {t.followers}
              </p>
            </div>
            <button type="button" className="btn-dark btn-sm">{t.follow}</button>
          </div>
          <div className="mx-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-border py-3">
            <strong className="text-[14px] text-ink">{t.menu}</strong>
            <span className="font-mono text-[11.5px] text-[#C2410C]" suppressHydrationWarning>{fmt(t.drops, { time })}</span>
          </div>
          <div className="grid gap-2.5 px-5 pb-5">
            {ITEMS.map((it, i) => {
              const p = exampleAmount(it.usd, currency);
              return (
                <div key={it.img} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3">
                  <Image src={`/images/home/${it.img}.jpg`} alt="" width={104} height={104} className="h-[52px] w-[52px] rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium leading-snug text-ink">{t.items[i]}</p>
                    <p className="text-[13.5px] text-muted tabular-nums" suppressHydrationWarning>{formatMoney(p.amount, p.currency, locale)}</p>
                  </div>
                  <button type="button" aria-label={t.add} className="grid h-8 w-8 place-items-center rounded-full border border-border bg-parchment text-ink">
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-5">
            <button type="button" className="btn-dark w-full py-3">{t.preorder}</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function safe<T>(f: () => T, fallback: T): T {
  try { return f(); } catch { return fallback; }
}
