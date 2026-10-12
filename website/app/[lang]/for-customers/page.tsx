import Image from 'next/image';
import type { Metadata } from 'next';
import { Heart, Sparkles, ShieldCheck, Clock, Gift, CalendarRange, ChefHat, Search } from 'lucide-react';
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
  const t = getDict(params.lang).forCustomers;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/for-customers' });
}

const WHY_ICONS = [Heart, Sparkles, CalendarRange, ChefHat, Gift, ShieldCheck];
const FLOW_ICONS = [Search, Heart, Clock];
// A taste of what creators make: dishes, not invented people.
const TASTE = [
  { img: 'ramen', dish: 'ramen' },
  { img: 'tacos', dish: 'tacos' },
  { img: 'skewers', dish: 'skewers' },
  { img: 'pho', dish: 'pho' },
  { img: 'sourdough', dish: 'sourdough' },
  { img: 'cake', dish: 'cake' },
] as const;

export default function ForCustomersPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.forCustomers;
  const L = (p: string) => localePath(lang, p);
  return (
    <Shell lang={lang}>
      <JsonLd data={[breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/for-customers' }]), faqSchema(t.faqs)]} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[
          { label: t.ctaApp, href: '#download', variant: 'primary' },
          { label: t.ctaHow, href: L('/how-it-works'), variant: 'ghost-light' },
        ]}
        image="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80"
        imageAlt={t.imageAlt}
      />

      {/* Why */}
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

      {/* A taste of what creators make */}
      <Section tone="cream">
        <div className="container-x">
          <SectionHeading kicker={t.tasteKicker} title={rich(t.tasteTitle)} intro={t.tasteIntro} />
          <div className="mt-14 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {TASTE.map((x, i) => (
              <FadeUp key={x.img} delay={(i % 3) * 0.06}>
                <figure className="relative m-0 overflow-hidden rounded-md bg-warm">
                  <Image
                    src={`/images/home/${x.img}.jpg`}
                    alt={d.home.dishes[x.dish]}
                    width={560}
                    height={560}
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    className="aspect-square w-full object-cover"
                  />
                  <figcaption className="absolute start-2.5 bottom-2.5 rounded bg-parchment px-2 py-1 text-[13px] font-medium text-ink">
                    {d.home.dishes[x.dish]}
                  </figcaption>
                </figure>
              </FadeUp>
            ))}
          </div>
          <p className="text-center text-muted text-sm mt-10">{t.tasteMore}</p>
        </div>
      </Section>

      {/* Flow */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.flowKicker} title={rich(t.flowTitle)} />
          <div className="mt-16 grid sm:grid-cols-3 gap-6">
            {t.flow.map((f, i) => {
              const Icon = FLOW_ICONS[i];
              return (
                <FadeUp key={f.title} delay={i * 0.08}>
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mx-auto mb-5">
                      <Icon size={24} strokeWidth={1.75} />
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-2">{f.title}</h3>
                    <p className="text-stone leading-relaxed text-[15px] max-w-xs mx-auto">{f.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Download */}
      <section className="bg-ink text-cream py-20 md:py-24 relative overflow-hidden" id="download">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(255,107,53,0.18),transparent_55%)]" />
        <div className="container-x relative flex flex-col items-center text-center">
          <FadeUp>
            <h2 className="font-serif font-bold text-[clamp(2rem,4.5vw,3.4rem)] leading-tight tracking-[-0.03em] text-cream max-w-2xl text-balance">{t.downloadTitle}</h2>
            <p className="text-cream/65 mt-5 max-w-lg mx-auto">{t.downloadBody}</p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="mt-9"><AppBadges variant="dark" t={d.common.appBadges} /></div>
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
          { label: t.ctaCommunities, href: L('/communities') },
        ]}
      />
    </Shell>
  );
}
