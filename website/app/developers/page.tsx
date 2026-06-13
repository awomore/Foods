import Link from 'next/link';
import type { Metadata } from 'next';
import { Boxes, ShieldCheck, Webhook, Plug, ArrowRight } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import CodeBlock, { MethodBadge } from '@/components/dev/CodeBlock';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { APIS } from '@/lib/apis';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Developers — build on the FOODS platform',
  description:
    'FOODS is infrastructure, not just an app. Integrate Order Assignment, Driver Status, Tracking, Webhooks, Settlement, and Partner Analytics APIs into your logistics operation.',
  path: '/developers',
  keywords: ['delivery API', 'logistics API Africa', 'order assignment API', 'fleet API', 'webhooks', 'settlement API'],
});

const principles = [
  { icon: Boxes, title: 'Infrastructure, not an app', body: 'Treat FOODS as a programmable logistics layer. Integrate it into the systems you already run.' },
  { icon: ShieldCheck, title: 'Secure by default', body: 'Bearer-token auth, signed webhooks, and scoped partner keys. Built for production from day one.' },
  { icon: Webhook, title: 'Event-driven', body: 'Subscribe to lifecycle events and stop polling. React the moment an order changes state.' },
  { icon: Plug, title: 'Built to extend', body: 'A consistent REST surface across orders, riders, tracking, settlement, and analytics.' },
];

const authSnippet = `# Authenticate every request with your partner key
curl https://api.foodsbyme.com/v1/orders/available \\
  -H "Authorization: Bearer $FOODS_PARTNER_KEY"

# All responses are JSON. Errors use standard HTTP status codes.`;

export default function DevelopersPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Developers', path: '/developers' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Developers"
          title={<>FOODS is <span className="text-gradient-spice italic">infrastructure</span>, not just an app.</>}
          intro="Integrate the logistics layer that powers Africa’s creator food economy. Route orders, track deliveries, reconcile settlement, and measure performance — all through one clean API."
          ctas={[
            { label: 'Talk to our platform team', href: 'mailto:partnerships@foodsbyme.com?subject=Partner API access', variant: 'primary' },
            { label: 'Explore the APIs', href: '#apis', variant: 'ghost-light' },
          ]}
        />

        {/* Principles */}
        <Section tone="parchment">
          <div className="container-x">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <SectionHeading
                  kicker="Why build on FOODS"
                  title={<>One network. <span className="text-gradient-spice italic">Every integration point.</span></>}
                  intro="Whether you run a large bike fleet or a regional franchise, the Partner API lets you operate FOODS delivery inside your own stack — with the reliability of infrastructure."
                />
                <div className="mt-10 grid sm:grid-cols-2 gap-6">
                  {principles.map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.title}>
                        <div className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-4">
                          <Icon size={20} />
                        </div>
                        <h3 className="font-serif text-lg text-ink mb-1.5">{p.title}</h3>
                        <p className="text-stone font-light text-[14px] leading-relaxed">{p.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <FadeUp delay={0.1} className="lg:sticky lg:top-28">
                <CodeBlock code={authSnippet} label="Authentication" />
              </FadeUp>
            </div>
          </div>
        </Section>

        {/* API directory */}
        <Section id="apis" tone="cream">
          <div className="container-x">
            <SectionHeading
              kicker="The platform"
              title={<>Six APIs that cover the <span className="text-gradient-spice italic">whole delivery lifecycle</span></>}
            />
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {APIS.map((api, i) => (
                <FadeUp key={api.slug} delay={(i % 3) * 0.07}>
                  <Link
                    href={`/developers/${api.slug}`}
                    className="group block card p-6 h-full hover:shadow-warm hover:-translate-y-1 transition-all duration-500"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      {api.endpoints.slice(0, 2).map((e) => (
                        <MethodBadge key={e.path} method={e.method} />
                      ))}
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-2">{api.name}</h3>
                    <p className="text-stone font-light text-[14px] leading-relaxed">{api.tagline}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-spice font-medium">
                      Read the docs <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </FadeUp>
              ))}
            </div>
          </div>
        </Section>

        <CtaBand
          title="Building something on FOODS?"
          intro="Partner API access is granted to logistics, franchise, and corporate partners. Tell us what you’re building and we’ll get you a key."
          tone="ink"
          ctas={[
            { label: 'Request API access', href: 'mailto:partnerships@foodsbyme.com?subject=Partner API access', primary: true },
            { label: 'Become a partner', href: '/fleet/apply' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
