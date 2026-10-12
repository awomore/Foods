import Link from 'next/link';
import type { Metadata } from 'next';
import { Bike, MapPinned, HeartHandshake, Check, ArrowRight } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { FadeUp } from '@/components/ui/FadeUp';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { fmt, rich } from '@/lib/i18n/rich';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).partnerTypes;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/fleet/partner-types' });
}

const ICONS: Record<string, typeof Bike> = { bike: Bike, fleet: Bike, logistics: Bike, franchise: MapPinned, corporate: HeartHandshake };

export default function PartnerTypesPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.partnerTypes;
  const L = (p: string) => localePath(lang, p);
  return (
    <Shell lang={lang}>
      <JsonLd
        data={breadcrumbSchema(lang, [
          { name: d.common.ui.home, path: '/' },
          { name: d.fleet.kicker, path: '/fleet' },
          { name: t.kicker, path: '/fleet/partner-types' },
        ])}
      />
      <PageHero kicker={t.kicker} title={rich(t.title)} intro={t.intro} ctas={[{ label: t.ctaStart, href: L('/fleet/apply'), variant: 'primary' }]} />

      <section className="bg-parchment py-20 md:py-28">
        <div className="container-x space-y-8">
          {d.fleet.types.map((x, i) => {
            const Icon = ICONS[x.id];
            return (
              <FadeUp key={x.id}>
                <article id={x.id} className="card overflow-hidden grid lg:grid-cols-[1fr_1.4fr] scroll-mt-24">
                  <div className="bg-ink text-cream p-8 sm:p-10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,107,53,0.2),transparent_60%)]" />
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-5">
                        <span className="w-12 h-12 rounded-2xl bg-spice text-cream flex items-center justify-center"><Icon size={22} /></span>
                        <span className="font-mono text-cream/35 text-2xl">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <h2 className="font-serif font-bold text-2xl sm:text-3xl text-cream">{x.name}</h2>
                      <p className="text-spice font-medium mt-2">{x.tagline}</p>
                      <p className="text-cream/60 mt-5 leading-relaxed text-[15px]">
                        <span className="text-cream/85 font-medium">{t.bestFor} </span>{x.best}
                      </p>
                      <p className="text-cream/55 text-[13px] mt-6 pt-5 border-t border-cream/10">
                        <span className="text-cream/75">{t.ceiling} </span>{x.ceiling}
                      </p>
                    </div>
                  </div>
                  <div className="p-8 sm:p-10 grid sm:grid-cols-2 gap-8">
                    <div>
                      <p className="kicker kicker-dot mb-4">{t.requirements}</p>
                      <ul className="space-y-3">
                        {x.requirements.map((r) => (
                          <li key={r} className="flex items-start gap-2.5 text-[14px] text-stone">
                            <Check size={16} className="text-spice mt-0.5 flex-shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="kicker kicker-dot mb-4">{t.whatYouGet}</p>
                      <ul className="space-y-3">
                        {x.support.map((s) => (
                          <li key={s} className="flex items-start gap-2.5 text-[14px] text-stone">
                            <Check size={16} className="text-gold mt-0.5 flex-shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href={L('/fleet/apply')} className="btn-ghost btn-sm mt-7">
                        {fmt(t.applyAs, { type: x.name })} <ArrowRight size={14} className="rtl-flip" />
                      </Link>
                    </div>
                  </div>
                </article>
              </FadeUp>
            );
          })}
        </div>
      </section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        tone="ink"
        ctas={[
          { label: t.ctaTalk, href: `mailto:${SITE.email.partnerships}`, primary: true },
          { label: t.ctaApply, href: L('/fleet/apply') },
        ]}
      />
    </Shell>
  );
}
