import type { Metadata } from 'next';
import { ArrowUpRight, Heart, Rocket, Globe2, Scale, Users, Laptop } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { JOBS } from '@/lib/data';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).careers;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/careers' });
}

const PERK_ICONS = [Rocket, Globe2, Heart, Laptop, Users, Scale];
const teams = Array.from(new Set(JOBS.map((j) => j.team)));

export default function CareersPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.careers;
  return (
    <Shell lang={lang}>
      <JsonLd data={breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/careers' }])} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[{ label: t.ctaRoles, href: '#roles', variant: 'primary' }]}
        image="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80"
        imageAlt={t.imageAlt}
      />

      {/* Perks */}
      <Section tone="parchment">
        <div className="container-x">
          <SectionHeading align="center" kicker={t.perksKicker} title={rich(t.perksTitle)} intro={t.perksIntro} />
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.perks.map((p, i) => {
              const Icon = PERK_ICONS[i];
              return (
                <FadeUp key={p.title} delay={(i % 3) * 0.08}>
                  <div className="card p-7 h-full">
                    <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-2">{p.title}</h3>
                    <p className="text-stone leading-relaxed text-[15px]">{p.body}</p>
                  </div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Open roles — job titles stay in English, the working language of the team. */}
      <Section tone="cream" id="roles">
        <div className="container-x">
          <SectionHeading kicker={t.rolesKicker} title={rich(t.rolesTitle)} intro={t.rolesIntro} />
          <div className="mt-12 space-y-12">
            {teams.map((team) => (
              <div key={team}>
                <h3 className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-muted mb-4" lang="en">{team}</h3>
                <div className="rounded-3xl border border-border overflow-hidden divide-y divide-border bg-parchment">
                  {JOBS.filter((j) => j.team === team).map((job) => (
                    <a
                      key={job.title}
                      href={`mailto:${SITE.email.careers}?subject=${encodeURIComponent(`Application: ${job.title}`)}`}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 hover:bg-warm transition-colors"
                    >
                      <div lang="en">
                        <p className="font-serif text-lg font-semibold text-ink group-hover:text-spice transition-colors">{job.title}</p>
                        <p className="text-[13px] text-muted mt-0.5">{job.location} · {job.type}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-spice flex-shrink-0">
                        {t.apply} <ArrowUpRight size={15} className="rtl-flip" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* No-fit band */}
      <Section tone="parchment">
        <div className="container-x">
          <div className="card p-8 sm:p-12 text-center max-w-3xl mx-auto">
            <FadeUp>
              <h2 className="font-serif font-bold text-2xl md:text-3xl text-ink mb-3">{t.noFitTitle}</h2>
              <p className="text-stone leading-relaxed mb-7 max-w-xl mx-auto">{t.noFitBody}</p>
              <a href={`mailto:${SITE.email.careers}?subject=General%20application`} className="btn-primary">{t.noFitCta}</a>
            </FadeUp>
          </div>
        </div>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        tone="ink"
        ctas={[
          { label: t.ctaRoles, href: '#roles', primary: true },
          { label: SITE.email.careers, href: `mailto:${SITE.email.careers}` },
        ]}
      />
    </Shell>
  );
}
