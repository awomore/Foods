import Link from 'next/link';
import type { Metadata } from 'next';
import { Bike, Truck, Building2, MapPinned, Briefcase, Check, ArrowRight } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { FadeUp } from '@/components/ui/FadeUp';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Fleet partner types & requirements',
  description:
    'Five pathways to partner with FOODS — individual bike owner, small fleet operator, large logistics company, regional franchise, and corporate logistics. See the requirements for each.',
  path: '/fleet/partner-types',
  keywords: ['delivery partner requirements', 'fleet operator', 'logistics franchise Nigeria', 'corporate delivery partner'],
});

const types = [
  {
    id: 'bike',
    icon: Bike,
    name: 'Individual bike owner',
    tagline: 'Ride yourself. Start earning this week.',
    best: 'You own a bike and want a steady, transparent income stream.',
    requirements: ['Roadworthy motorcycle', 'Valid rider’s licence', 'Smartphone (Android/iOS)', 'Right to operate in your city', 'Bank account for settlement'],
    support: ['Driver app & live order flow', 'Per-order settlement', 'Safety & service training', 'Co-branded rider kit'],
    ceiling: 'Grow into a small fleet by adding riders.',
  },
  {
    id: 'fleet',
    icon: Truck,
    name: 'Small fleet operator',
    tagline: 'Run 3–15 bikes with managed order flow.',
    best: 'You manage a handful of riders and want technology to scale.',
    requirements: ['3–15 roadworthy bikes', 'Riders with valid licences', 'A registered business name (or in progress)', 'Operating base in a live city'],
    support: ['Fleet dashboard & rider management', 'Automated assignment & routing', 'Dedicated onboarding session', 'Priority operational support'],
    ceiling: 'Unlock a defined territory as you prove reliability.',
  },
  {
    id: 'logistics',
    icon: Building2,
    name: 'Large logistics company',
    tagline: 'Plug an existing operation into creator demand.',
    best: 'You run 15+ vehicles and want incremental, predictable volume.',
    requirements: ['15+ vehicles / riders', 'Registered logistics company', 'Operational management in place', 'Insurance & compliance documents'],
    support: ['Bulk order assignment API access', 'Volume-based commercial terms', 'Account manager', 'Performance analytics suite'],
    ceiling: 'Multi-zone operation with API integration.',
  },
  {
    id: 'franchise',
    icon: MapPinned,
    name: 'Regional franchise partner',
    tagline: 'Own a territory end-to-end.',
    best: 'You want to build and run FOODS delivery for an entire region.',
    requirements: ['Capital to establish a local operation', 'Local market knowledge', 'Registered company', 'Commitment to brand standards'],
    support: ['Exclusive territory rights', 'Full brand & marketing kit', 'Launch playbook & training', 'Regional growth incentives'],
    ceiling: 'Expand into adjacent territories over time.',
  },
  {
    id: 'corporate',
    icon: Briefcase,
    name: 'Corporate logistics partner',
    tagline: 'Enterprise integration & B2B delivery.',
    best: 'You’re an enterprise that wants to integrate FOODS logistics.',
    requirements: ['Enterprise logistics capability', 'Technical team for API integration', 'Compliance & SLA readiness', 'Signed enterprise agreement'],
    support: ['Full Partner API access', 'Custom SLAs & webhooks', 'Settlement API & reconciliation', 'Dedicated solutions engineer'],
    ceiling: 'Co-build infrastructure across markets.',
  },
];

export default function PartnerTypesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Fleet partners', path: '/fleet' }, { name: 'Partner types', path: '/fleet/partner-types' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Pathways"
          title={<>Find the pathway that fits <span className="text-gradient-spice italic">your operation</span></>}
          intro="Five ways to partner with FOODS, each with its own requirements, support, and growth ceiling. Pick where you are today — you can always move up."
          ctas={[{ label: 'Start your application', href: '/fleet/apply', variant: 'primary' }]}
        />

        <section className="bg-parchment py-20 md:py-28">
          <div className="container-x space-y-8">
            {types.map((t, i) => {
              const Icon = t.icon;
              return (
                <FadeUp key={t.id}>
                  <article id={t.id} className="card overflow-hidden grid lg:grid-cols-[1fr_1.4fr] scroll-mt-24">
                    {/* Left summary */}
                    <div className="bg-ink text-cream p-8 sm:p-10 grain relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(200,75,49,0.22),transparent_60%)]" />
                      <div className="relative">
                        <div className="flex items-center gap-3 mb-5">
                          <span className="w-12 h-12 rounded-2xl bg-spice text-cream flex items-center justify-center">
                            <Icon size={22} />
                          </span>
                          <span className="font-serif text-cream/30 text-3xl">{String(i + 1).padStart(2, '0')}</span>
                        </div>
                        <h2 className="font-serif text-2xl sm:text-3xl text-cream">{t.name}</h2>
                        <p className="text-spice/90 font-medium mt-2">{t.tagline}</p>
                        <p className="text-cream/55 font-light mt-5 leading-relaxed text-[15px]">
                          <span className="text-cream/80 font-medium">Best for: </span>{t.best}
                        </p>
                        <p className="text-cream/45 text-[13px] mt-6 pt-5 border-t border-cream/10">
                          <span className="text-cream/70">Growth ceiling: </span>{t.ceiling}
                        </p>
                      </div>
                    </div>
                    {/* Right detail */}
                    <div className="p-8 sm:p-10 grid sm:grid-cols-2 gap-8">
                      <div>
                        <p className="kicker kicker-dot mb-4">Requirements</p>
                        <ul className="space-y-3">
                          {t.requirements.map((r) => (
                            <li key={r} className="flex items-start gap-2.5 text-[14px] text-stone">
                              <Check size={16} className="text-spice mt-0.5 flex-shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="kicker kicker-dot mb-4">What you get</p>
                        <ul className="space-y-3">
                          {t.support.map((s) => (
                            <li key={s} className="flex items-start gap-2.5 text-[14px] text-stone">
                              <Check size={16} className="text-gold mt-0.5 flex-shrink-0" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                        <Link href="/fleet/apply" className="btn-ghost btn-sm mt-7">
                          Apply as {t.name.toLowerCase()} <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </article>
                </FadeUp>
              );
            })}
          </div>
        </section>

        <CtaBand
          title="Not sure which pathway is right?"
          intro="Tell us about your operation and our partnerships team will point you to the best fit."
          tone="ink"
          ctas={[
            { label: 'Talk to partnerships', href: 'mailto:partnerships@foodsbyme.com', primary: true },
            { label: 'Start an application', href: '/fleet/apply' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
