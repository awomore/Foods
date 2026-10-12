import type { Metadata } from 'next';
import { Store, CalendarRange, GraduationCap, Package, ChefHat, Gift, Wallet, BarChart3, ShieldCheck, Megaphone } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import Accordion from '@/components/site/Accordion';
import JsonLd from '@/components/site/JsonLd';
import { AppBadges } from '@/components/site/AppBadges';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema, faqSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).forCreators;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/for-creators' });
}

const EARN_ICONS = [Store, CalendarRange, ChefHat, GraduationCap, Package, Gift];
const TOOL_ICONS = [Wallet, BarChart3, ShieldCheck, Megaphone];

export default function ForCreatorsPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.forCreators;
  return (
    <Shell lang={lang}>
      <JsonLd data={[breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/for-creators' }]), faqSchema(t.faqs)]} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[
          { label: t.ctaOpen, href: SITE.app.ios, variant: 'primary' },
          { label: t.ctaHow, href: '#start', variant: 'ghost-light' },
        ]}
        image="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1600&q=80"
        imageAlt={t.imageAlt}
      />

      {/* Ways to earn */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.earnKicker} title={rich(t.earnTitle)} intro={t.earnIntro} />
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.earn.map((e, i) => {
              const Icon = EARN_ICONS[i];
              return (
                <FadeUp key={e.title} delay={(i % 3) * 0.08}>
                  <div className="card p-7 h-full">
                    <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-2">{e.title}</h3>
                    <p className="text-stone leading-relaxed text-[15px]">{e.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Tools */}
      <Section tone="cream">
        <div className="container-x">
          <SectionHeading kicker={t.toolsKicker} title={rich(t.toolsTitle)} intro={t.toolsIntro} />
          <div className="mt-14 grid sm:grid-cols-2 gap-6">
            {t.tools.map((x, i) => {
              const Icon = TOOL_ICONS[i];
              return (
                <FadeUp key={x.title} delay={(i % 2) * 0.08}>
                  <div className="card p-7 h-full flex gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-warm text-spice flex items-center justify-center flex-shrink-0">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl text-ink mb-2">{x.title}</h3>
                      <p className="text-stone leading-relaxed text-[15px]">{x.body}</p>
                    </div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* How to start */}
      <Section tone="parchment" id="start">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.startKicker} title={rich(t.startTitle)} />
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.start.map((s, i) => (
              <FadeUp key={s.title} delay={i * 0.08}>
                <div className="h-full">
                  <span className="font-mono text-3xl text-spice/50 leading-none tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-serif text-xl text-ink mt-4 mb-2">{s.title}</h3>
                  <p className="text-stone leading-relaxed text-[15px]">{s.body}</p>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.1}>
            <div className="mt-14 flex justify-center">
              <AppBadges t={d.common.appBadges} />
            </div>
          </FadeUp>
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
          { label: t.ctaOpen, href: SITE.app.ios, primary: true },
          { label: t.ctaTeam, href: `mailto:${SITE.email.creators}` },
        ]}
      />
    </Shell>
  );
}
