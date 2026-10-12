import Link from 'next/link';
import { localePath, type Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n/dict';

const APIS = [['Order Assignment API', 'REST'], ['Tracking API', 'REST'], ['Webhooks', 'events']];

export default function Partners({ lang, t }: { lang: Locale; t: Dict['home']['partners'] }) {
  return (
    <section className="bg-parchment py-[clamp(64px,9vw,120px)]">
      <div className="container-x grid lg:grid-cols-2 gap-[clamp(16px,2vw,28px)]">
        <article className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] overflow-hidden rounded-[10px] border border-border">
          <div className="grid content-start gap-3 p-[clamp(22px,3vw,34px)]">
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">{t.fleetKicker}</p>
            <h3 className="font-serif text-[clamp(1.6rem,2.4vw,2rem)] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">{t.fleetTitle}</h3>
            <p className="text-[15px] text-stone">{t.fleetBody}</p>
            <Link href={localePath(lang, '/fleet/apply')} className="btn-dark btn-sm mt-2 justify-self-start">{t.fleetCta}</Link>
          </div>
          <ul className="grid content-center gap-2 px-[clamp(22px,3vw,34px)] pb-[clamp(22px,3vw,34px)] sm:ps-0 sm:pt-[clamp(22px,3vw,34px)]">
            {t.fleetTypes.map(([name, sub]) => (
              <li key={name} className="flex justify-between gap-3 rounded-md border border-border px-3.5 py-3 text-[14.5px] font-medium text-ink">
                {name} <span className="font-mono text-[11.5px] font-normal text-muted">{sub}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] overflow-hidden rounded-[10px] bg-ink text-cream">
          <div className="grid content-start gap-3 p-[clamp(22px,3vw,34px)]">
            <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-cream/60">{t.devKicker}</p>
            <h3 className="font-serif text-[clamp(1.6rem,2.4vw,2rem)] font-semibold leading-[1.05] tracking-[-0.025em]">{t.devTitle}</h3>
            <p className="text-[15px] text-cream/65">{t.devBody}</p>
            <Link href={localePath(lang, '/developers')} className="btn btn-sm mt-2 justify-self-start bg-cream text-ink hover:bg-warm px-5 py-2.5">
              {t.devCta}
            </Link>
          </div>
          <ul className="grid content-center gap-2 px-[clamp(22px,3vw,34px)] pb-[clamp(22px,3vw,34px)] sm:ps-0 sm:pt-[clamp(22px,3vw,34px)]" dir="ltr">
            {APIS.map(([name, kind]) => (
              <li key={name} className="flex justify-between gap-3 rounded-md border border-[#262626] px-3.5 py-3 font-mono text-[12.5px]">
                {name} <span className="text-cream/55">{kind}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
