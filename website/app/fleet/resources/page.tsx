import type { Metadata } from 'next';
import { Calculator } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import KitDownloads from '@/components/fleet/KitDownloads';
import RevenueCalculator from '@/components/fleet/RevenueCalculator';
import { Section, SectionHeading } from '@/components/ui/Section';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Fleet partner kit — guides, handbook & revenue calculator',
  description:
    'Download the FOODS fleet partner kit: Fleet Partner Guide, Operations Handbook, Territory Guide, Franchise Pack, and Partnership Deck — plus an interactive revenue calculator.',
  path: '/fleet/resources',
  keywords: ['fleet partner guide', 'delivery revenue calculator', 'operations handbook', 'franchise information pack'],
});

export default function ResourcesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Fleet partners', path: '/fleet' }, { name: 'Partner kit', path: '/fleet/resources' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Partner kit"
          title={<>Everything you need to <span className="text-gradient-spice italic">plan your business</span></>}
          intro="Branded, downloadable guides plus an interactive revenue calculator. Model your fleet, understand the operation, and decide with confidence."
          ctas={[{ label: 'Apply to partner', href: '/fleet/apply', variant: 'primary' }]}
        />

        {/* Calculator */}
        <Section tone="parchment">
          <div className="container-x">
            <div className="flex items-center gap-3 mb-8">
              <span className="w-11 h-11 rounded-2xl bg-spice text-cream flex items-center justify-center">
                <Calculator size={20} />
              </span>
              <div>
                <p className="kicker kicker-dot">Revenue calculator</p>
                <h2 className="font-serif text-2xl text-ink mt-1">Model your fleet earnings</h2>
              </div>
            </div>
            <RevenueCalculator />
          </div>
        </Section>

        {/* Downloads */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading
              kicker="Downloads"
              title={<>The full <span className="text-gradient-spice italic">partner kit</span></>}
              intro="Each document is generated as a clean, branded PDF you can save or print. Built to be read, shared with stakeholders, and acted on."
            />
            <div className="mt-12">
              <KitDownloads />
            </div>
          </div>
        </Section>

        <CtaBand
          title="Questions before you commit?"
          intro="Our partnerships team is happy to walk you through the numbers and the territory map for your area."
          tone="ink"
          ctas={[
            { label: 'Book a call', href: 'mailto:partnerships@foodsbyme.com?subject=Book a fleet partnership call', primary: true },
            { label: 'Apply now', href: '/fleet/apply' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
