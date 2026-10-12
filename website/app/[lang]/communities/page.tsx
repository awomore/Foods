import type { Metadata } from 'next';
import { Gift, Users, HeartHandshake, Sparkles, MessageCircle, Trophy, HandHeart, Globe2 } from 'lucide-react';
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

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).communities;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/communities' });
}

const PILLAR_ICONS = [Gift, Users, HeartHandshake, Trophy];
const WAY_ICONS = [HandHeart, Sparkles, MessageCircle, Globe2];

export default function CommunitiesPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.communities;
  return (
    <Shell lang={lang}>
      <JsonLd data={[breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/communities' }]), faqSchema(t.faqs)]} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[
          { label: t.ctaApp, href: SITE.app.ios, variant: 'primary' },
          { label: t.ctaCreators, href: localePath(lang, '/for-creators'), variant: 'ghost-light' },
        ]}
        image="https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1600&q=80"
        imageAlt={t.imageAlt}
      />

      {/* Pillars */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.pillarsKicker} title={rich(t.pillarsTitle)} intro={t.pillarsIntro} />
          <div className="mt-16 grid sm:grid-cols-2 gap-6">
            {t.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i];
              return (
                <FadeUp key={p.title} delay={(i % 2) * 0.08}>
                  <div className="card p-8 h-full flex gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl text-ink mb-2">{p.title}</h3>
                      <p className="text-stone leading-relaxed text-[15px]">{p.body}</p>
                    </div>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Gifting feature */}
      <Section tone="ink">
        <div className="container-x grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <FadeUp>
              <span className="kicker kicker-dot">{t.giftKicker}</span>
              <h2 className="font-serif font-bold text-[clamp(2rem,4vw,3rem)] leading-tight tracking-[-0.03em] text-cream mt-5 text-balance">{t.giftTitle}</h2>
              <p className="text-cream/70 leading-relaxed mt-5 text-lg">{t.giftBody}</p>
            </FadeUp>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {t.ways.map((w, i) => {
              const Icon = WAY_ICONS[i];
              return (
                <FadeUp key={w.title} delay={i * 0.07}>
                  <div className="rounded-3xl border border-cream/15 bg-cream/[0.04] p-6 h-full">
                    <div className="w-11 h-11 rounded-2xl bg-spice/15 text-spice flex items-center justify-center mb-4">
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <h3 className="font-serif text-lg text-cream mb-1.5">{w.title}</h3>
                    <p className="text-cream/60 text-[14px] leading-relaxed">{w.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="parchment">
        <div className="container-x grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
          <SectionHeading kicker={d.common.ui.questions} title={t.faqTitle} />
          <Accordion items={t.faqs} />
        </div>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        ctas={[
          { label: t.ctaApp, href: SITE.app.ios, primary: true },
          { label: t.ctaFund, href: `mailto:${SITE.email.hello}?subject=Community%20gifting%20for%20groups` },
        ]}
      />
    </Shell>
  );
}
