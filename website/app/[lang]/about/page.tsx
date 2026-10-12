import type { Metadata } from 'next';
import { Flame, Users, Bike, Globe2, Heart, Compass, Sparkles, Scale } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).about;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/about' });
}

const PILLAR_ICONS = [Flame, Users, Bike, Globe2];
const VALUE_ICONS = [Flame, Heart, Scale, Compass];

export default function AboutPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.about;
  return (
    <Shell lang={lang}>
      <JsonLd data={breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/about' }])} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        image="https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=1600&q=80"
        imageAlt={t.imageAlt}
      />

      {/* Manifesto */}
      <Section tone="parchment">
        <div className="container-narrow text-center">
          <FadeUp>
            <span className="kicker kicker-dot justify-center">{t.beliefKicker}</span>
          </FadeUp>
          <FadeUp delay={0.06}>
            <p className="font-serif font-semibold text-[clamp(1.7rem,3.4vw,2.6rem)] leading-snug tracking-[-0.02em] text-ink mt-6 text-balance">
              {t.belief}
            </p>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-8 text-stone leading-relaxed text-lg max-w-2xl mx-auto text-pretty">{t.beliefBody}</p>
          </FadeUp>
        </div>
      </Section>

      {/* What we're building */}
      <Section tone="cream">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.pillarsKicker} title={rich(t.pillarsTitle)} intro={t.pillarsIntro} />
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {t.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i];
              return (
                <FadeUp key={p.title} delay={i * 0.07}>
                  <div className="card p-7 h-full">
                    <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-2">{p.title}</h3>
                    <p className="text-stone leading-relaxed text-[14px]">{p.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Values */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading kicker={t.valuesKicker} title={rich(t.valuesTitle)} />
          <div className="mt-14 grid sm:grid-cols-2 gap-6">
            {t.values.map((v, i) => {
              const Icon = VALUE_ICONS[i];
              return (
                <FadeUp key={v.title} delay={(i % 2) * 0.08}>
                  <div className="card p-8 h-full flex gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-warm text-spice flex items-center justify-center flex-shrink-0">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl text-ink mb-2">{v.title}</h3>
                      <p className="text-stone leading-relaxed text-[15px]">{v.body}</p>
                    </div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Vision band */}
      <Section tone="ink">
        <div className="container-x grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <FadeUp>
            <Sparkles size={36} className="text-spice mb-5" />
            <h2 className="font-serif font-bold text-[clamp(2rem,4vw,3rem)] leading-tight tracking-[-0.03em] text-cream text-balance">{t.visionTitle}</h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="space-y-5 text-cream/70 text-lg leading-relaxed">
              <p>{t.visionBody1}</p>
              <p>{t.visionBody2}</p>
            </div>
          </FadeUp>
        </div>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        ctas={[
          { label: t.ctaRoles, href: localePath(lang, '/careers'), primary: true },
          { label: t.ctaContact, href: localePath(lang, '/contact') },
        ]}
      />
    </Shell>
  );
}
