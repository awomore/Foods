'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, Bike, MapPinned, HeartHandshake, LayoutDashboard } from 'lucide-react';
import { SITE } from '@/lib/site';
import type { Dict } from '@/lib/i18n/dict';
import { fmt } from '@/lib/i18n/rich';
import { COUNTRIES } from '@/lib/geo';
import { regionName, useVisitor } from '@/lib/visitor';

const TYPE_ICONS: Record<string, typeof Bike> = { bike: Bike, fleet: Bike, logistics: Bike, franchise: MapPinned, corporate: HeartHandshake };

type FormData = {
  type: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  area: string;
  fleetSize: number | null;
};

const empty: FormData = { type: '', name: '', email: '', phone: '', country: '', area: '', fleetSize: null };

export default function ApplyForm({
  lang,
  t,
  types,
  back,
  next,
}: {
  lang: string;
  t: Dict['apply']['form'];
  types: { id: string; name: string }[];
  back: string;
  next: string;
}) {
  const { country } = useVisitor();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(empty);
  const [submitted, setSubmitted] = useState(false);

  // Start on the visitor's own country; they can change it.
  useEffect(() => {
    if (country) setData((d) => (d.country ? d : { ...d, country }));
  }, [country]);

  const countries = useMemo(
    () => COUNTRIES.map((cc) => [cc, regionName(cc, lang)] as const).sort((a, b) => a[1].localeCompare(b[1], lang)),
    [lang],
  );

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setData((d) => ({ ...d, [k]: v }));
  const typeName = types.find((x) => x.id === data.type)?.name ?? '';
  const sizeLabel = data.fleetSize === null ? '' : t.sizes[data.fleetSize];
  const location = [data.area, data.country ? regionName(data.country, lang) : ''].filter(Boolean).join(', ');

  const canProceed =
    step === 0 ? !!data.type
    : step === 1 ? data.name.trim().length > 1 && /\S+@\S+\.\S+/.test(data.email) && data.phone.trim().length >= 7
    : step === 2 ? !!data.country
    : step === 3 ? data.fleetSize !== null
    : true;

  function submit() {
    // The partnerships team reads applications in English, so the email is written in English.
    const en = (cc: string) => regionName(cc, 'en');
    const sizesEn = ['1 bike', '2–5 bikes', '6–15 bikes', '16–50 bikes', '50+ bikes'];
    const subject = encodeURIComponent(`Fleet partner application: ${data.type}`);
    const body = encodeURIComponent(
      `Partner type: ${data.type}\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nCountry: ${en(data.country)} (${data.country})\nCity/area: ${data.area || '—'}\nFleet size: ${data.fleetSize === null ? '—' : sizesEn[data.fleetSize]}\nSite language: ${lang}`,
    );
    window.location.href = `mailto:${SITE.email.partnerships}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  if (submitted) return <SuccessState t={t} name={data.name} />;

  return (
    <div className="card p-6 sm:p-10 shadow-warm-lg">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-9">
        {t.steps.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1 rounded-full transition-colors duration-500 ${i <= step ? 'bg-spice' : 'bg-warm'}`} />
            <p className={`mt-2 text-[11px] font-medium hidden sm:block ${i === step ? 'text-ink' : 'text-muted'}`}>
              {i + 1}. {label}
            </p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 0 && (
            <Field title={t.typeTitle} hint={t.typeHint}>
              <div className="grid sm:grid-cols-2 gap-3">
                {types.map((x, i) => {
                  const Icon = TYPE_ICONS[x.id] ?? Bike;
                  const active = data.type === x.id;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => set('type', x.id)}
                      className={`text-start rounded-2xl border p-4 flex gap-3 transition-all ${active ? 'border-spice bg-spice/5 ring-1 ring-spice' : 'border-border hover:border-ink/25'}`}
                    >
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-spice text-cream' : 'bg-warm text-stone'}`}>
                        <Icon size={18} />
                      </span>
                      <span>
                        <span className="block text-[14px] font-semibold text-ink">{x.name}</span>
                        <span className="block text-[12px] text-muted mt-0.5">{t.typeDescs[i]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {step === 1 && (
            <Field title={t.contactTitle} hint={t.contactHint}>
              <div className="space-y-4">
                <Input id="ap-name" label={t.name} value={data.name} onChange={(v) => set('name', v)} placeholder={t.namePlaceholder} />
                <Input id="ap-email" label={t.email} type="email" value={data.email} onChange={(v) => set('email', v)} placeholder="you@example.com" />
                <Input id="ap-phone" label={t.phone} type="tel" value={data.phone} onChange={(v) => set('phone', v)} placeholder={t.phonePlaceholder} />
              </div>
            </Field>
          )}

          {step === 2 && (
            <Field title={t.locationTitle} hint={t.locationHint}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="ap-country" className="block text-[13px] font-medium text-stone mb-2">{t.country}</label>
                  <select
                    id="ap-country"
                    value={data.country}
                    onChange={(e) => set('country', e.target.value)}
                    className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink focus:border-spice focus:ring-1 focus:ring-spice outline-none"
                  >
                    <option value="">{t.chooseCountry}</option>
                    {countries.map(([cc, n]) => (
                      <option key={cc} value={cc}>{n}</option>
                    ))}
                  </select>
                </div>
                <Input id="ap-area" label={t.area} value={data.area} onChange={(v) => set('area', v)} placeholder={t.areaPlaceholder} />
              </div>
            </Field>
          )}

          {step === 3 && (
            <Field title={t.sizeTitle} hint={t.sizeHint}>
              <div className="grid sm:grid-cols-2 gap-3">
                {t.sizes.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('fleetSize', i)}
                    className={`rounded-2xl border p-4 text-start text-[14px] font-semibold transition-all ${data.fleetSize === i ? 'border-spice bg-spice/5 ring-1 ring-spice text-ink' : 'border-border text-stone hover:border-ink/25'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {step === 4 && (
            <Field title={t.reviewTitle} hint={t.reviewHint}>
              <dl className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
                {[
                  [t.partnerType, typeName],
                  [t.name, data.name],
                  [t.email, data.email],
                  [t.phone, data.phone],
                  [t.location, location],
                  [t.fleetSize, sizeLabel],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3 bg-cream">
                    <dt className="text-[13px] text-muted">{k}</dt>
                    <dd className="text-[13px] font-medium text-ink text-end">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            </Field>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-between mt-8">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`inline-flex items-center gap-2 text-[14px] font-medium text-stone hover:text-ink transition-colors ${step === 0 ? 'invisible' : ''}`}
        >
          <ArrowLeft size={16} className="rtl-flip" /> {back}
        </button>
        {step < t.steps.length - 1 ? (
          <button
            type="button"
            onClick={() => canProceed && setStep((s) => s + 1)}
            disabled={!canProceed}
            className={`btn-primary ${!canProceed ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {next} <ArrowRight size={16} className="rtl-flip" />
          </button>
        ) : (
          <button type="button" onClick={submit} className="btn-primary">
            {t.submit} <Check size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-2xl text-ink">{title}</h3>
      {hint && <p className="text-[14px] text-muted mt-1.5 mb-6">{hint}</p>}
      {children}
    </div>
  );
}

function Input({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-stone mb-2">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-spice focus:ring-1 focus:ring-spice outline-none transition-colors"
      />
    </div>
  );
}

function SuccessState({ t, name }: { t: Dict['apply']['form']; name: string }) {
  const first = name.trim().split(' ')[0];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8">
      <div className="card p-8 sm:p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-spice text-cream flex items-center justify-center mx-auto mb-5">
          <Check size={26} />
        </div>
        <h3 className="font-serif text-3xl text-ink">{first ? fmt(t.receivedTitle, { name: first }) : t.receivedTitleNoName}</h3>
        <p className="text-stone mt-3 max-w-md mx-auto">{t.receivedBody}</p>
      </div>

      {/* Dashboard preview */}
      <div className="card overflow-hidden">
        <div className="bg-ink text-cream px-6 py-4 flex items-center gap-2">
          <LayoutDashboard size={16} className="text-spice" />
          <span className="text-[13px] font-semibold">{t.dashboardPreview}</span>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
          {t.dashboardStats.map((k) => (
            <div key={k} className="bg-cream p-5 text-center">
              <p className="font-serif text-2xl text-ink">—</p>
              <p className="text-[11px] text-muted mt-1">{k}</p>
            </div>
          ))}
        </div>
        <p className="px-6 pb-6 text-[12px] text-muted">{t.dashboardNote}</p>
      </div>

      {/* Timeline */}
      <div className="card p-8">
        <h4 className="font-serif text-xl text-ink mb-6">{t.timelineTitle}</h4>
        <ol className="space-y-5">
          {t.timeline.map((o, i) => (
            <li key={o.t} className="flex gap-4">
              <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold ${i === 0 ? 'bg-spice text-cream' : 'bg-warm text-stone'}`}>
                {i === 0 ? <Check size={14} /> : i + 1}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">{o.t}</span>
                <span className="block text-[13px] text-stone mt-0.5">{o.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  );
}
