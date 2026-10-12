import Link from 'next/link';
import type { Metadata } from 'next';
import { TrendingUp, Map, Cpu, BadgeCheck, LifeBuoy, GraduationCap, Bike, MapPinned, HeartHandshake, ArrowRight, Download } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import Accordion from '@/components/site/Accordion';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema, faqSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

const OG = 'https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&w=1200&q=80';

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).fleet;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/fleet', ogImage: OG });
}

const WHY_ICONS = [TrendingUp, Map, Cpu, BadgeCheck, LifeBuoy, GraduationCap];
const TYPE_ICONS: Record<string, typeof Bike> = { bike: Bike, fleet: Bike, logistics: Bike, franchise: MapPinned, corporate: HeartHandshake };

export default function FleetPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.fleet;
  const L = (p: string) => localePath(lang, p);
  return (
    <Shell lang={lang}>
      <JsonLd data={[breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/fleet' }]), faqSchema(t.faqs)]} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[
          { label: t.ctaPartner, href: L('/fleet/apply'), variant: 'primary' },
          { label: t.ctaKit, href: L('/fleet/resources'), variant: 'ghost-light' },
        ]}
        image="https://images.unsplash.com/photo-1617347454431-f49d7ff5c3b1?auto=format&fit=crop&w=1600&q=80"
        imageAlt={t.imageAlt}
      />

      {/* Why partner */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.whyKicker} title={rich(t.whyTitle)} intro={t.whyIntro} />
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.why.map((w, i) => {
              const Icon = WHY_ICONS[i];
              return (
                <FadeUp key={w.title} delay={(i % 3) * 0.08}>
                  <div className="card p-7 h-full">
                    <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-2">{w.title}</h3>
                    <p className="text-stone leading-relaxed text-[15px]">{w.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Partner types teaser */}
      <Section tone="cream">
        <div className="container-x">
          <SectionHeading kicker={t.pathsKicker} title={rich(t.pathsTitle)} intro={t.pathsIntro} />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {t.types.map((p, i) => {
              const Icon = TYPE_ICONS[p.id];
              return (
                <FadeUp key={p.id} delay={i * 0.06}>
                  <Link href={L(`/fleet/partner-types#${p.id}`)} className="group block card p-6 h-full hover:shadow-warm hover:-translate-y-1 transition-all duration-500">
                    <div className="w-11 h-11 rounded-2xl bg-warm text-spice flex items-center justify-center mb-4 group-hover:bg-spice group-hover:text-cream transition-colors">
                      <Icon size={20} />
                    </div>
                    <p className="text-[14px] font-semibold text-ink leading-snug">{p.name}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[12px] text-spice font-medium">
                      {t.seeRequirements} <ArrowRight size={13} className="rtl-flip group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Kit CTA */}
      <Section tone="parchment">
        <div className="container-x">
          <div className="card overflow-hidden grid md:grid-cols-2">
            <div className="p-8 sm:p-12">
              <FadeUp>
                <span className="kicker kicker-dot">{t.kitKicker}</span>
                <h2 className="font-serif font-bold text-3xl text-ink mt-5 mb-4">{t.kitTitle}</h2>
                <p className="text-stone leading-relaxed mb-7">{t.kitBody}</p>
                <Link href={L('/fleet/resources')} className="btn-primary">
                  <Download size={16} /> {t.ctaKit}
                </Link>
              </FadeUp>
            </div>
            <div className="bg-ink text-cream p-8 sm:p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(255,107,53,0.22),transparent_60%)]" />
              <ul className="relative space-y-4">
                {t.kitDocs.map((doc) => (
                  <li key={doc} className="flex items-center gap-3 text-cream/85">
                    <Download size={15} className="text-spice flex-shrink-0" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="cream">
        <div className="container-x grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
          <SectionHeading kicker={d.common.ui.questions} title={t.faqTitle} />
          <Accordion items={t.faqs} />
        </div>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        ctas={[
          { label: t.ctaApply, href: L('/fleet/apply'), primary: true },
          { label: SITE.email.partnerships, href: `mailto:${SITE.email.partnerships}` },
        ]}
      />
    </Shell>
  );
}
