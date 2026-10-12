'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Dict } from '@/lib/i18n/dict';
import { currencyFor, exampleAmount, formatMoney } from '@/lib/geo';
import { formatLocale, useVisitor } from '@/lib/visitor';

// Starting payout per delivered order, in local currency. Illustrative planning
// defaults the partner adjusts with the slider, not quoted rates.
const DEFAULT_PAYOUT: Record<string, number> = {
  NGN: 750, GHS: 15, KES: 150, ZAR: 35, EGP: 50, MAD: 15, INR: 60, PKR: 200, BDT: 100, IDR: 15000,
  PHP: 80, VND: 30000, THB: 50, MYR: 7, BRL: 8, MXN: 45, USD: 5, EUR: 4.5, GBP: 4, CAD: 6, AUD: 7,
  JPY: 600, KRW: 5000, CNY: 10, AED: 15, SAR: 15, TRY: 60, PLN: 15,
};

function band(currency: string) {
  let cur = currency;
  let def = DEFAULT_PAYOUT[cur];
  if (def === undefined) {
    const ex = exampleAmount(3, cur);
    cur = ex.currency;
    def = ex.amount;
  }
  const mag = Math.pow(10, Math.floor(Math.log10(def / 15)));
  const step = Math.max(mag, def < 20 ? 0.5 : 1);
  const snap = (x: number) => Math.max(step, Math.round(x / step) * step);
  return { currency: cur, def: snap(def), min: snap(def * 0.4), max: snap(def * 3), step };
}

export default function RevenueCalculator({ lang, t }: { lang: string; t: Dict['resources']['calc'] }) {
  const { country } = useVisitor();
  const b = useMemo(() => band(currencyFor(country)), [country]);
  const locale = formatLocale(lang, country);

  const [riders, setRiders] = useState(5);
  const [ordersPerDay, setOrdersPerDay] = useState(18);
  const [avgPayout, setAvgPayout] = useState(b.def);
  const [daysPerWeek, setDaysPerWeek] = useState(6);

  // A new country means a new currency: start again from that currency's default.
  useEffect(() => setAvgPayout(b.def), [b]);

  const money = (n: number) => formatMoney(Math.round(n), b.currency, locale);
  const num = (n: number) => n.toLocaleString(locale);

  const { weekly, monthly, partnerShare } = useMemo(() => {
    const grossWeekly = riders * ordersPerDay * avgPayout * daysPerWeek;
    const grossMonthly = grossWeekly * 4.33;
    // Illustrative: operator keeps a margin per order after rider pay & costs.
    return { weekly: grossWeekly, monthly: grossMonthly, partnerShare: grossMonthly * 0.28 };
  }, [riders, ordersPerDay, avgPayout, daysPerWeek]);

  return (
    <div className="card p-6 sm:p-8">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-7">
          <Slider id="rc-riders" label={t.riders} value={riders} min={1} max={40} onChange={setRiders} display={`${num(riders)} ${riders === 1 ? t.rider : t.ridersUnit}`} />
          <Slider id="rc-orders" label={t.orders} value={ordersPerDay} min={4} max={40} onChange={setOrdersPerDay} display={`${num(ordersPerDay)} ${t.ordersUnit}`} />
          <Slider id="rc-payout" label={t.payout} value={avgPayout} min={b.min} max={b.max} step={b.step} onChange={setAvgPayout} display={formatMoney(avgPayout, b.currency, locale)} />
          <Slider id="rc-days" label={t.days} value={daysPerWeek} min={3} max={7} onChange={setDaysPerWeek} display={`${num(daysPerWeek)} ${t.daysUnit}`} />
          <p className="text-[12.5px] text-muted">
            {t.currency}: <span className="font-mono text-ink">{b.currency}</span>
          </p>
        </div>

        <div className="bg-ink text-cream rounded-3xl p-7 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_10%,rgba(255,107,53,0.22),transparent_60%)]" />
          <div className="relative">
            <p className="text-cream/60 font-mono text-[11.5px] uppercase tracking-[0.1em]">{t.monthly}</p>
            <p className="font-serif font-bold text-[clamp(2.2rem,5vw,3.2rem)] text-cream leading-none mt-2 tabular-nums" suppressHydrationWarning>{money(monthly)}</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-cream/5 border border-cream/10 p-4">
                <p className="text-cream/60 text-[11px]">{t.weekly}</p>
                <p className="font-serif text-xl text-cream mt-1 tabular-nums" suppressHydrationWarning>{money(weekly)}</p>
              </div>
              <div className="rounded-2xl bg-cream/5 border border-cream/10 p-4">
                <p className="text-cream/60 text-[11px]">{t.margin}</p>
                <p className="font-serif text-xl text-spice mt-1 tabular-nums" suppressHydrationWarning>{money(partnerShare)}</p>
              </div>
            </div>
            <p className="text-cream/45 text-[11.5px] mt-5 leading-relaxed">{t.disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  display: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <label htmlFor={id} className="text-[14px] font-medium text-stone">{label}</label>
        <span className="font-serif text-lg text-ink tabular-nums whitespace-nowrap" suppressHydrationWarning>{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-spice h-2 cursor-pointer"
      />
    </div>
  );
}
