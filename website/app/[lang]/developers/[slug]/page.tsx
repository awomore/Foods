import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check, ArrowLeft } from 'lucide-react';
import Shell, { EnglishOnlyNote } from '@/components/site/Shell';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import CodeBlock, { MethodBadge } from '@/components/dev/CodeBlock';
import { FadeUp } from '@/components/ui/FadeUp';
import { Kicker } from '@/components/ui/Section';
import { APIS, getApi } from '@/lib/apis';
import { LOCALES, localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { SITE } from '@/lib/site';
import { pageMeta, pageUrl, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale; slug: string } };

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => APIS.map((a) => ({ lang, slug: a.slug })));
}

export function generateMetadata({ params }: P): Metadata {
  const api = getApi(params.slug);
  if (!api) return {};
  const meta = pageMeta(params.lang, {
    title: api.name,
    description: `${api.tagline} ${api.intro}`.slice(0, 155),
    path: `/developers/${api.slug}`,
  });
  // The reference is English; every language version points at the English original.
  return { ...meta, alternates: { canonical: pageUrl('en', `/developers/${api.slug}`) } };
}

export default function ApiDocPage({ params }: P) {
  const api = getApi(params.slug);
  if (!api) notFound();
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.developers;
  const L = (p: string) => localePath(lang, p);

  return (
    <Shell lang={lang} mainClassName="bg-parchment">
      <JsonLd
        data={breadcrumbSchema(lang, [
          { name: d.common.ui.home, path: '/' },
          { name: t.kicker, path: '/developers' },
          { name: api.name, path: `/developers/${api.slug}` },
        ])}
      />
      <div className="pt-[72px]">
        <EnglishOnlyNote lang={lang} text={t.englishNote} />
      </div>
      <div className="container-x pt-12 pb-20 md:pt-16">
        <div className="grid lg:grid-cols-[230px_1fr] gap-12">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Link href={L('/developers')} className="inline-flex items-center gap-1.5 text-[13px] text-stone hover:text-ink mb-6">
              <ArrowLeft size={14} className="rtl-flip" /> {t.docOverview}
            </Link>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted mb-3">{t.docReference}</p>
            <nav className="space-y-1" lang="en">
              {APIS.map((a) => (
                <Link
                  key={a.slug}
                  href={L(`/developers/${a.slug}`)}
                  className={`block px-3 py-2 rounded-xl text-[13.5px] transition-colors ${
                    a.slug === api.slug ? 'bg-spice/10 text-spice font-semibold' : 'text-stone hover:bg-warm'
                  }`}
                >
                  {a.name}
                </Link>
              ))}
            </nav>
          </aside>

          <article className="max-w-3xl min-w-0" lang="en" dir="ltr">
            <FadeUp>
              <Kicker>{t.docKicker}</Kicker>
              <h1 className="font-serif font-bold text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.05] tracking-[-0.03em] text-ink mt-5">{api.name}</h1>
              <p className="text-spice font-medium mt-3 text-lg">{api.tagline}</p>
              <p className="text-stone text-lg leading-relaxed mt-5">{api.intro}</p>
            </FadeUp>

            <FadeUp delay={0.06}>
              <div className="mt-10 card p-7">
                <p className="kicker kicker-dot mb-5">{t.docCapabilities}</p>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {api.capabilities.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-[14px] text-stone">
                      <Check size={16} className="text-spice mt-0.5 flex-shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>

            <FadeUp delay={0.08}>
              <h2 className="font-serif font-bold text-2xl text-ink mt-14 mb-5">{t.docEndpoints}</h2>
              <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {api.endpoints.map((e) => (
                  <div key={e.path} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4 bg-cream">
                    <div className="flex items-center gap-3 sm:w-[44%]">
                      <MethodBadge method={e.method} />
                      <code className="text-[13px] text-ink font-mono break-all">{e.path}</code>
                    </div>
                    <p className="text-[13px] text-muted">{e.summary}</p>
                  </div>
                ))}
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <h2 className="font-serif font-bold text-2xl text-ink mt-14 mb-5">{api.sampleTitle}</h2>
              <div className="space-y-4">
                <CodeBlock code={api.sampleRequest} label={t.docRequest} />
                <CodeBlock code={api.sampleResponse} label={t.docResponse} />
              </div>
            </FadeUp>
          </article>
        </div>
      </div>

      <CtaBand
        title={t.docCtaTitle}
        intro={t.docCtaBody}
        tone="ink"
        ctas={[
          { label: t.ctaRequest, href: `mailto:${SITE.email.partnerships}?subject=Partner API access`, primary: true },
          { label: t.docBack, href: L('/developers') },
        ]}
      />
    </Shell>
  );
}
