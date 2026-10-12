import type { Metadata } from 'next';
import { Calculator } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import KitDownloads from '@/components/fleet/KitDownloads';
import RevenueCalculator from '@/components/fleet/RevenueCalculator';
import { Section, SectionHeading } from '@/components/ui/Section';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).resources;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/fleet/resources' });
}

export default function ResourcesPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.resources;
  const L = (p: string) => localePath(lang, p);
  return (
    <Shell lang={lang}>
      <JsonLd
        data={breadcrumbSchema(lang, [
          { name: d.common.ui.home, path: '/' },
          { name: d.fleet.kicker, path: '/fleet' },
          { name: t.kicker, path: '/fleet/resources' },
        ])}
      />
      <PageHero kicker={t.kicker} title={rich(t.title)} intro={t.intro} ctas={[{ label: t.ctaApply, href: L('/fleet/apply'), variant: 'primary' }]} />

      {/* Calculator */}
      <Section tone="parchment">
        <div className="container-x">
          <div className="flex items-center gap-3 mb-8">
            <span className="w-11 h-11 rounded-2xl bg-spice text-cream flex items-center justify-center">
              <Calculator size={20} />
            </span>
            <div>
              <p className="kicker kicker-dot">{t.calcKicker}</p>
              <h2 className="font-serif font-bold text-2xl text-ink mt-1">{t.calcTitle}</h2>
            </div>
          </div>
          <RevenueCalculator lang={lang} t={t.calc} />
        </div>
      </Section>

      {/* Downloads */}
      <Section tone="cream">
        <div className="container-x">
          <SectionHeading kicker={t.downloadsKicker} title={rich(t.downloadsTitle)} intro={t.downloadsIntro} />
          {lang !== 'en' && <p className="mt-4 text-[13px] text-muted">{t.englishNote}</p>}
          <div className="mt-12">
            <KitDownloads t={t} />
          </div>
        </div>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        tone="ink"
        ctas={[
          { label: t.ctaCall, href: `mailto:${SITE.email.partnerships}?subject=Book a fleet partnership call`, primary: true },
          { label: t.ctaApplyNow, href: L('/fleet/apply') },
        ]}
      />
    </Shell>
  );
}
