import Link from 'next/link';
import type { Metadata } from 'next';
import { Boxes, ShieldCheck, Webhook, Plug, ArrowRight } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import CodeBlock, { MethodBadge } from '@/components/dev/CodeBlock';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { APIS } from '@/lib/apis';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).developers;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/developers' });
}

const ICONS = [Boxes, ShieldCheck, Webhook, Plug];

const authSnippet = `# Authenticate every request with your partner key
curl https://api.foodsbyme.com/v1/orders/available \\
  -H "Authorization: Bearer $FOODS_PARTNER_KEY"

# All responses are JSON. Errors use standard HTTP status codes.`;

const ACCESS = `mailto:${SITE.email.partnerships}?subject=Partner API access`;

export default function DevelopersPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.developers;
  const L = (p: string) => localePath(lang, p);
  return (
    <Shell lang={lang}>
      <JsonLd data={breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/developers' }])} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[
          { label: t.ctaTalk, href: ACCESS, variant: 'primary' },
          { label: t.ctaExplore, href: '#apis', variant: 'ghost-light' },
        ]}
      />

      {/* Principles */}
      <Section tone="parchment">
        <div className="container-x">
          <div className="grid lg:grid-cols-2 gap-12 items-start [&>*]:min-w-0">
            <div>
              <SectionHeading kicker={t.whyKicker} title={rich(t.whyTitle)} intro={t.whyIntro} />
              <div className="mt-10 grid sm:grid-cols-2 gap-6">
                {t.principles.map((p, i) => {
                  const Icon = ICONS[i];
                  return (
                    <div key={p.title}>
                      <div className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-4">
                        <Icon size={20} />
                      </div>
                      <h3 className="font-serif text-lg text-ink mb-1.5">{p.title}</h3>
                      <p className="text-stone text-[14px] leading-relaxed">{p.body}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <FadeUp delay={0.1} className="min-w-0 lg:sticky lg:top-28">
              <div dir="ltr">
                <CodeBlock code={authSnippet} label={t.authLabel} />
              </div>
            </FadeUp>
          </div>
        </div>
      </Section>

      {/* API directory */}
      <Section id="apis" tone="cream">
        <div className="container-x">
          <SectionHeading kicker={t.apisKicker} title={rich(t.apisTitle)} />
          {lang !== 'en' && <p className="mt-4 text-[13px] text-muted">{t.englishNote}</p>}
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {APIS.map((api, i) => (
              <FadeUp key={api.slug} delay={(i % 3) * 0.07}>
                <Link href={L(`/developers/${api.slug}`)} className="group block card p-6 h-full hover:shadow-warm hover:-translate-y-1 transition-all duration-500">
                  <div className="flex items-center gap-2 mb-4" dir="ltr">
                    {api.endpoints.slice(0, 2).map((e) => (
                      <MethodBadge key={e.path} method={e.method} />
                    ))}
                  </div>
                  <h3 className="font-serif text-xl text-ink mb-2" lang="en">{api.name}</h3>
                  <p className="text-stone text-[14px] leading-relaxed" lang="en">{api.tagline}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-spice font-medium">
                    {t.readDocs} <ArrowRight size={14} className="rtl-flip group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </FadeUp>
            ))}
          </div>
        </div>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        tone="ink"
        ctas={[
          { label: t.ctaRequest, href: ACCESS, primary: true },
          { label: t.ctaPartner, href: L('/fleet/apply') },
        ]}
      />
    </Shell>
  );
}
