import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check, ArrowLeft } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import CodeBlock, { MethodBadge } from '@/components/dev/CodeBlock';
import { FadeUp } from '@/components/ui/FadeUp';
import { Kicker } from '@/components/ui/Section';
import { APIS, getApi } from '@/lib/apis';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export function generateStaticParams() {
  return APIS.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const api = getApi(params.slug);
  if (!api) return {};
  return pageMeta({
    title: api.name,
    description: `${api.tagline} ${api.intro}`.slice(0, 155),
    path: `/developers/${api.slug}`,
    keywords: ['FOODS API', api.name.toLowerCase(), 'delivery API', 'logistics API'],
  });
}

export default function ApiDocPage({ params }: { params: { slug: string } }) {
  const api = getApi(params.slug);
  if (!api) notFound();

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Developers', path: '/developers' }, { name: api.name, path: `/developers/${api.slug}` }])} />
      <SiteNav />
      <main className="bg-parchment">
        <div className="container-x pt-32 pb-20 md:pt-40">
          <div className="grid lg:grid-cols-[230px_1fr] gap-12">
            {/* Sidebar */}
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <Link href="/developers" className="inline-flex items-center gap-1.5 text-[13px] text-stone hover:text-ink mb-6">
                <ArrowLeft size={14} /> Platform overview
              </Link>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-semibold mb-3">Reference</p>
              <nav className="space-y-1">
                {APIS.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/developers/${a.slug}`}
                    className={`block px-3 py-2 rounded-xl text-[13.5px] transition-colors ${
                      a.slug === api.slug ? 'bg-spice/10 text-spice font-semibold' : 'text-stone hover:bg-warm'
                    }`}
                  >
                    {a.name}
                  </Link>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <article className="max-w-3xl">
              <FadeUp>
                <Kicker>API reference</Kicker>
                <h1 className="font-serif text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.05] tracking-[-0.02em] text-ink mt-5">
                  {api.name}
                </h1>
                <p className="text-spice font-medium mt-3 text-lg">{api.tagline}</p>
                <p className="text-stone font-light text-lg leading-relaxed mt-5">{api.intro}</p>
              </FadeUp>

              {/* Capabilities */}
              <FadeUp delay={0.06}>
                <div className="mt-10 card p-7">
                  <p className="kicker kicker-dot mb-5">Capabilities</p>
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

              {/* Endpoints */}
              <FadeUp delay={0.08}>
                <h2 className="font-serif text-2xl text-ink mt-14 mb-5">Endpoints</h2>
                <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                  {api.endpoints.map((e) => (
                    <div key={e.path} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-4 bg-cream">
                      <div className="flex items-center gap-3 sm:w-[44%]">
                        <MethodBadge method={e.method} />
                        <code className="text-[13px] text-ink font-mono">{e.path}</code>
                      </div>
                      <p className="text-[13px] text-muted">{e.summary}</p>
                    </div>
                  ))}
                </div>
              </FadeUp>

              {/* Example */}
              <FadeUp delay={0.1}>
                <h2 className="font-serif text-2xl text-ink mt-14 mb-5">{api.sampleTitle}</h2>
                <div className="space-y-4">
                  <CodeBlock code={api.sampleRequest} label="Request" />
                  <CodeBlock code={api.sampleResponse} label="Response · 200 OK" />
                </div>
              </FadeUp>
            </article>
          </div>
        </div>

        <CtaBand
          title="Ready to integrate?"
          intro="Request a partner key and our solutions team will help you go live."
          tone="ink"
          ctas={[
            { label: 'Request API access', href: 'mailto:partnerships@foodsbyme.com?subject=Partner API access', primary: true },
            { label: 'Back to platform', href: '/developers' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
