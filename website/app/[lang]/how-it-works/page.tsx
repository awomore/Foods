import Link from 'next/link';
import type { Metadata } from 'next';
import { Compass, Heart, Flame, ShoppingBag, Users, Bike, ArrowRight, Search, Bell, CalendarDays } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import Accordion from '@/components/site/Accordion';
import JsonLd from '@/components/site/JsonLd';
import { AppBadges } from '@/components/site/AppBadges';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { pageMeta, breadcrumbSchema, faqSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).howItWorks;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/how-it-works' });
}

const STEP_ICONS = [Compass, Heart, Flame, ShoppingBag, Users];
const DISCOVERY_ICONS = [Search, Bell, CalendarDays];
const ROLES = [
  { icon: Heart, href: '/for-customers' },
  { icon: Flame, href: '/for-creators' },
  { icon: Bike, href: '/fleet' },
];

export default function HowItWorksPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.howItWorks;
  const L = (p: string) => localePath(lang, p);
  return (
    <Shell lang={lang}>
      <JsonLd data={[breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/how-it-works' }]), faqSchema(t.faqs)]} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[
          { label: t.ctaApp, href: '#download', variant: 'primary' },
          { label: t.ctaCreators, href: L('/for-creators'), variant: 'ghost-light' },
        ]}
      />

      {/* The five steps */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.journeyKicker} title={rich(t.journeyTitle)} intro={t.journeyIntro} />
          <div className="mt-16 space-y-4">
            {t.steps.map((s, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <FadeUp key={s.title} delay={(i % 2) * 0.06}>
                  <div className="card p-7 sm:p-9 flex flex-col sm:flex-row gap-6 sm:items-center">
                    <div className="flex items-center gap-5 sm:w-[42%]">
                      <span className="font-mono text-2xl text-spice/50 leading-none tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-2xl text-ink">{s.title}</h3>
                    </div>
                    <p className="text-stone leading-relaxed text-[15px] sm:flex-1">{s.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Discovery details */}
      <Section tone="cream">
        <div className="container-x">
          <SectionHeading kicker={t.discoveryKicker} title={rich(t.discoveryTitle)} intro={t.discoveryIntro} />
          <div className="mt-14 grid sm:grid-cols-3 gap-6">
            {t.discovery.map((x, i) => {
              const Icon = DISCOVERY_ICONS[i];
              return (
                <FadeUp key={x.title} delay={i * 0.08}>
                  <div className="card p-7 h-full">
                    <div className="w-12 h-12 rounded-2xl bg-warm text-spice flex items-center justify-center mb-5">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-2">{x.title}</h3>
                    <p className="text-stone leading-relaxed text-[15px]">{x.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Three doors */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.rolesKicker} title={rich(t.rolesTitle)} />
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {t.roles.map((f, i) => {
              const Icon = ROLES[i].icon;
              return (
                <FadeUp key={f.label} delay={i * 0.08}>
                  <Link href={L(ROLES[i].href)} className="group block card p-8 h-full hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-500">
                    <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-6 group-hover:bg-spice group-hover:text-cream transition-colors">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <p className="kicker kicker-dot mb-3">{f.label}</p>
                    <h3 className="font-serif text-2xl text-ink mb-3">{f.title}</h3>
                    <p className="text-stone leading-relaxed text-[15px] mb-6">{f.body}</p>
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-spice font-medium">
                      {d.common.ui.learnMore} <ArrowRight size={14} className="rtl-flip group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Download band */}
      <section className="bg-ink text-cream py-20 md:py-24 relative overflow-hidden" id="download">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,rgba(255,107,53,0.18),transparent_55%)]" />
        <div className="container-x relative flex flex-col items-center text-center">
          <FadeUp>
            <h2 className="font-serif font-bold text-[clamp(2rem,4.5vw,3.4rem)] leading-tight tracking-[-0.03em] text-cream max-w-2xl text-balance">{t.downloadTitle}</h2>
            <p className="text-cream/65 mt-5 max-w-lg mx-auto">{t.downloadBody}</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="mt-9">
              <AppBadges variant="dark" t={d.common.appBadges} />
            </div>
          </FadeUp>
        </div>
      </section>

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
          { label: t.ctaApp, href: '#download', primary: true },
          { label: t.ctaForCreators, href: L('/for-creators') },
        ]}
      />
    </Shell>
  );
}
