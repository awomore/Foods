'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, Bike, MapPinned, HeartHandshake, LayoutDashboard } from 'lucide-react';
import { SITE } from '@/lib/site';

const PARTNER_TYPES = [
  { id: 'bike', label: 'Individual rider', desc: 'A bicycle or motorbike, riding yourself.', icon: Bike },
  { id: 'fleet', label: 'Small fleet operator', desc: '3–15 bikes with riders.', icon: Bike },
  { id: 'logistics', label: 'Large fleet operator', desc: '15+ bicycles or motorbikes.', icon: Bike },
  { id: 'franchise', label: 'Regional franchise partner', desc: 'Own a territory end-to-end.', icon: MapPinned },
  { id: 'corporate', label: 'Rider cooperative / community group', desc: 'Riders organising together.', icon: HeartHandshake },
];

const FLEET_SIZES = ['1 bike', '2–5 bikes', '6–15 bikes', '16–50 bikes', '50+ bikes'];
const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Other'];

const STEPS = ['Partner type', 'Contact', 'Location', 'Fleet size', 'Review'];

type FormData = {
  type: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  area: string;
  fleetSize: string;
};

const empty: FormData = { type: '', name: '', email: '', phone: '', city: '', area: '', fleetSize: '' };

export default function ApplyForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(empty);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof FormData, v: string) => setData((d) => ({ ...d, [k]: v }));

  const canProceed =
    step === 0 ? !!data.type
    : step === 1 ? data.name.trim().length > 1 && /\S+@\S+\.\S+/.test(data.email) && data.phone.trim().length >= 7
    : step === 2 ? !!data.city
    : step === 3 ? !!data.fleetSize
    : true;

  async function submit() {
    setLoading(true);
    setError('');
    const typeLabel = PARTNER_TYPES.find((t) => t.id === data.type)?.label ?? data.type;

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          partner_type: typeLabel,
          location: `${data.area ? data.area + ', ' : ''}${data.city}`,
          fleet_size: data.fleetSize,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      // API unavailable — fall back to mailto so no application is ever lost.
      const subject = encodeURIComponent(`Fleet partner application — ${typeLabel}`);
      const body = encodeURIComponent(
        `Partner type: ${typeLabel}\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nLocation: ${data.area ? data.area + ', ' : ''}${data.city}\nFleet size: ${data.fleetSize}`
      );
      window.open(`mailto:${SITE.email.partnerships}?subject=${subject}&body=${body}`);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) return <SuccessState data={data} />;

  return (
    <div className="card p-6 sm:p-10 shadow-warm-lg">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-9">
        {STEPS.map((label, i) => (
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
            <Field title="What kind of partner are you?" hint="Choose the closest fit — you can refine details later.">
              <div className="grid sm:grid-cols-2 gap-3">
                {PARTNER_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = data.type === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => set('type', t.id)}
                      className={`text-left rounded-2xl border p-4 flex gap-3 transition-all ${active ? 'border-spice bg-spice/5 ring-1 ring-spice' : 'border-border hover:border-ink/25'}`}
                    >
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-spice text-cream' : 'bg-warm text-stone'}`}>
                        <Icon size={18} />
                      </span>
                      <span>
                        <span className="block text-[14px] font-semibold text-ink">{t.label}</span>
                        <span className="block text-[12px] text-muted mt-0.5">{t.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {step === 1 && (
            <Field title="How do we reach you?" hint="We’ll only use this to process your application.">
              <div className="space-y-4">
                <Input label="Full name" value={data.name} onChange={(v) => set('name', v)} placeholder="Samuel Adebayo" />
                <Input label="Email" type="email" value={data.email} onChange={(v) => set('email', v)} placeholder="you@example.com" />
                <Input label="Phone (WhatsApp)" value={data.phone} onChange={(v) => set('phone', v)} placeholder="+234 800 000 0000" />
              </div>
            </Field>
          )}

          {step === 2 && (
            <Field title="Where will you operate?" hint="Territory availability varies by area.">
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-stone mb-2">Country</label>
                  <div className="flex flex-wrap gap-2">
                    {COUNTRIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => set('city', c)}
                        className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-all ${data.city === c ? 'bg-ink text-cream border-ink' : 'border-border text-stone hover:border-ink/25'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="City / area (optional)" value={data.area} onChange={(v) => set('area', v)} placeholder="e.g. your city or neighbourhood" />
              </div>
            </Field>
          )}

          {step === 3 && (
            <Field title="How big is your fleet today?" hint="An estimate is fine — we’ll confirm during onboarding.">
              <div className="grid sm:grid-cols-2 gap-3">
                {FLEET_SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => set('fleetSize', s)}
                    className={`rounded-2xl border p-4 text-left text-[14px] font-semibold transition-all ${data.fleetSize === s ? 'border-spice bg-spice/5 ring-1 ring-spice text-ink' : 'border-border text-stone hover:border-ink/25'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {step === 4 && (
            <Field title="Review & submit" hint="Confirm your details. Our partnerships team responds within 48 hours.">
              <dl className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
                {[
                  ['Partner type', PARTNER_TYPES.find((t) => t.id === data.type)?.label],
                  ['Name', data.name],
                  ['Email', data.email],
                  ['Phone', data.phone],
                  ['Location', `${data.area ? data.area + ', ' : ''}${data.city}`],
                  ['Fleet size', data.fleetSize],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-3 bg-cream">
                    <dt className="text-[13px] text-muted">{k}</dt>
                    <dd className="text-[13px] font-medium text-ink text-right">{v || '—'}</dd>
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
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`inline-flex items-center gap-2 text-[14px] font-medium text-stone hover:text-ink transition-colors ${step === 0 ? 'invisible' : ''}`}
        >
          <ArrowLeft size={16} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => canProceed && setStep((s) => s + 1)}
            disabled={!canProceed}
            className={`btn-primary ${!canProceed ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={submit} disabled={loading} className={`btn-primary ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
            {loading ? 'Submitting…' : <><span>Submit application</span> <Check size={16} /></>}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-4 text-[13px] text-red-600 font-light text-center">{error}</p>
      )}
    </div>
  );
}

function Field({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-2xl text-ink">{title}</h3>
      {hint && <p className="text-[14px] text-muted mt-1.5 mb-6 font-light">{hint}</p>}
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-stone mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-spice focus:ring-1 focus:ring-spice outline-none transition-colors"
      />
    </div>
  );
}

function SuccessState({ data }: { data: FormData }) {
  const onboarding = [
    { t: 'Application received', d: 'You’re in the queue. Look out for a WhatsApp from our partnerships team.', done: true },
    { t: 'Verification call (24–48h)', d: 'A quick call to confirm your fleet, documents, and operating area.' },
    { t: 'Onboarding & training', d: 'Driver app setup, brand kit, and a hands-on session with an ops lead.' },
    { t: 'First orders routed', d: 'Go live in your territory and start earning, typically within a week.' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-8">
      <div className="card p-8 sm:p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-spice text-cream flex items-center justify-center mx-auto mb-5">
          <Check size={26} />
        </div>
        <h3 className="font-serif text-3xl text-ink">Application received{data.name ? `, ${data.name.split(' ')[0]}` : ''}.</h3>
        <p className="text-stone mt-3 font-light max-w-md mx-auto">
          Our partnerships team will reach out within 48 hours. In the meantime, here’s what happens next — and a peek at the dashboard you’ll run your fleet from.
        </p>
      </div>

      {/* Dashboard preview */}
      <div className="card overflow-hidden">
        <div className="bg-ink text-cream px-6 py-4 flex items-center gap-2">
          <LayoutDashboard size={16} className="text-spice" />
          <span className="text-[13px] font-semibold">Partner dashboard — preview</span>
        </div>
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
          {[
            ['Active riders', '—'],
            ['Orders today', '—'],
            ['On-time rate', '—'],
            ['Pending settlement', '₦—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-cream p-5 text-center">
              <p className="font-serif text-2xl text-ink">{v}</p>
              <p className="text-[11px] text-muted mt-1">{k}</p>
            </div>
          ))}
        </div>
        <p className="px-6 pb-6 text-[12px] text-muted">Your live numbers populate here once you go live.</p>
      </div>

      {/* Timeline */}
      <div className="card p-8">
        <h4 className="font-serif text-xl text-ink mb-6">Your onboarding timeline</h4>
        <ol className="space-y-5">
          {onboarding.map((o, i) => (
            <li key={o.t} className="flex gap-4">
              <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold ${o.done ? 'bg-spice text-cream' : 'bg-warm text-stone'}`}>
                {o.done ? <Check size={14} /> : i + 1}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">{o.t}</span>
                <span className="block text-[13px] text-stone font-light mt-0.5">{o.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  );
}
