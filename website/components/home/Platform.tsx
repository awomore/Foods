import { CreditCard, Globe, ShieldCheck, Bike } from 'lucide-react';
import type { Dict } from '@/lib/i18n/dict';

const ICONS = [CreditCard, Globe, ShieldCheck, Bike];

/** Every claim here maps to something shipped: local rails, 23 locales, held payments + 24h disputes, partner fleets. */
export default function Platform({ t }: { t: Dict['home']['platform'] }) {
  return (
    <section className="bg-parchment py-[clamp(64px,9vw,120px)]">
      <div className="container-x">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">{t.kicker}</p>
        <h2 className="mt-3 font-serif font-bold text-[clamp(2.1rem,4.4vw,3.75rem)] leading-none tracking-[-0.035em] text-ink text-balance">
          {t.title}
        </h2>
        <div className="mt-[clamp(32px,4vw,52px)] grid sm:grid-cols-2 lg:grid-cols-4 gap-x-[clamp(20px,3vw,40px)] gap-y-9">
          {t.items.map((it, i) => {
            const Icon = ICONS[i];
            return (
              <div key={it.title} className="grid content-start gap-2.5 border-t border-ink pt-5">
                <Icon size={26} strokeWidth={1.6} className="text-ink" aria-hidden />
                <h3 className="mt-2 font-serif text-[20px] font-semibold tracking-[-0.015em] text-ink">{it.title}</h3>
                <p className="text-[15px] text-stone">{it.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
