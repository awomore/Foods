'use client';

import { useState, useMemo } from 'react';

const naira = (n: number) =>
  '₦' + Math.round(n).toLocaleString('en-NG');

export default function RevenueCalculator() {
  const [riders, setRiders] = useState(5);
  const [ordersPerDay, setOrdersPerDay] = useState(18);
  const [avgPayout, setAvgPayout] = useState(750);
  const [daysPerWeek, setDaysPerWeek] = useState(6);

  const { weekly, monthly, partnerShare } = useMemo(() => {
    const grossWeekly = riders * ordersPerDay * avgPayout * daysPerWeek;
    const grossMonthly = grossWeekly * 4.33;
    // Illustrative: operator keeps a margin per order after rider pay & costs.
    const operatorMonthly = grossMonthly * 0.28;
    return { weekly: grossWeekly, monthly: grossMonthly, partnerShare: operatorMonthly };
  }, [riders, ordersPerDay, avgPayout, daysPerWeek]);

  return (
    <div className="card p-6 sm:p-8">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-7">
          <Slider label="Riders in your fleet" value={riders} min={1} max={40} onChange={setRiders} suffix={riders === 1 ? 'rider' : 'riders'} />
          <Slider label="Orders per rider / day" value={ordersPerDay} min={4} max={40} onChange={setOrdersPerDay} suffix="orders" />
          <Slider label="Average payout / order" value={avgPayout} min={400} max={2000} step={50} onChange={setAvgPayout} prefix="₦" />
          <Slider label="Operating days / week" value={daysPerWeek} min={3} max={7} onChange={setDaysPerWeek} suffix="days" />
        </div>

        <div className="bg-ink text-cream rounded-3xl p-7 flex flex-col justify-center grain relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_10%,rgba(200,75,49,0.25),transparent_60%)]" />
          <div className="relative">
            <p className="text-cream/50 text-[12px] uppercase tracking-[0.18em] font-semibold">Estimated fleet gross / month</p>
            <p className="font-serif text-[clamp(2.4rem,5vw,3.4rem)] text-cream leading-none mt-2">{naira(monthly)}</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-cream/5 border border-cream/10 p-4">
                <p className="text-cream/50 text-[11px]">Gross / week</p>
                <p className="font-serif text-xl text-cream mt-1">{naira(weekly)}</p>
              </div>
              <div className="rounded-2xl bg-cream/5 border border-cream/10 p-4">
                <p className="text-cream/50 text-[11px]">Your est. operator margin</p>
                <p className="font-serif text-xl text-gradient-spice mt-1">{naira(partnerShare)}</p>
              </div>
            </div>
            <p className="text-cream/35 text-[11px] mt-5 leading-relaxed">
              Illustrative estimate for planning only. Actual earnings depend on order volume, territory, rider pay, fuel, and operating costs. Operator margin assumes ~28% retained after rider payouts and running costs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  prefix = '',
  suffix = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[14px] font-medium text-stone">{label}</label>
        <span className="font-serif text-lg text-ink">
          {prefix}
          {value.toLocaleString('en-NG')} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-spice h-2 cursor-pointer"
        aria-label={label}
      />
    </div>
  );
}
