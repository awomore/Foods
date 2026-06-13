import Link from 'next/link';
import type { Metadata } from 'next';
import {
  TrendingUp, Map, Cpu, BadgeCheck, LifeBuoy, GraduationCap,
  Bike, Users, Network, MapPinned, HeartHandshake, ArrowRight, Download,
} from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import Accordion from '@/components/site/Accordion';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { Counter } from '@/components/ui/Counter';
import { pageMeta, breadcrumbSchema, faqSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Build the delivery network powering Africa’s creator economy',
  description:
    'Become a FOODS fleet partner. Bicycle and motorbike riders, bike fleets, cooperatives, and community transport groups get the technology, brand, training, and order flow to build real delivery businesses.',
  path: '/fleet',
  keywords: ['fleet partnership Nigeria', 'bike delivery partner', 'motorbike rider income', 'bicycle courier Africa', 'become a delivery partner'],
  ogImage: 'https://images.unsplash.com/photo-1591768793355-74d04bb6608f?auto=format&fit=crop&w=1200&q=80',
});

const why = [
  { icon: TrendingUp, title: 'Real revenue', body: 'Earn on every order routed to your fleet, with transparent settlement and no hidden deductions.' },
  { icon: Map, title: 'Territory ownership', body: 'Grow from open zones to a defined, protected territory you operate and expand.' },
  { icon: Cpu, title: 'Technology support', body: 'Order assignment, live tracking, settlement, and analytics — the full logistics stack, free.' },
  { icon: BadgeCheck, title: 'Brand support', body: 'Operate under a brand creators and customers trust. Co-branded kit and marketing included.' },
  { icon: LifeBuoy, title: 'Operational support', body: 'A dedicated ops lead, rider onboarding help, and support that actually picks up.' },
  { icon: GraduationCap, title: 'Training', body: 'Hands-on training for you and your riders — safety, service, and the driver app.' },
];

const partnerTypes = [
  { icon: Bike, label: 'Individual rider', href: '/fleet/partner-types#bike' },
  { icon: Users, label: 'Small fleet operator', href: '/fleet/partner-types#fleet' },
  { icon: Network, label: 'Large fleet operator', href: '/fleet/partner-types#logistics' },
  { icon: MapPinned, label: 'Regional franchise partner', href: '/fleet/partner-types#franchise' },
  { icon: HeartHandshake, label: 'Rider cooperative or community group', href: '/fleet/partner-types#corporate' },
];

const growthStats = [
  { value: 4200, suffix: '+', label: 'Active partners on the network' },
  { value: 18, suffix: ' min', label: 'Median delivery time' },
  { value: 96, suffix: '%', label: 'Orders delivered on time' },
  { value: 340, prefix: '₦', suffix: 'k', label: 'Avg. monthly net / active rider' },
];

const faqs = [
  { q: 'What do I need to start as a rider?', a: 'A roadworthy bicycle or motorbike, a valid rider’s licence (for motorbikes), a smartphone, and the right to operate in your area. We handle the rest — app access, training, and order flow.' },
  { q: 'How does settlement work?', a: 'Earnings accrue per delivered order and are settled to your registered account on a regular cycle. Your dashboard shows pending and paid settlement in real time.' },
  { q: 'Can I add riders later?', a: 'Yes. Most partners start small and scale. Once you’ve proven reliability, you can add riders and bikes, unlock more order volume, and eventually a defined territory.' },
  { q: 'Is there a fee to join?', a: 'No joining fee for individual riders and small bike fleets. Franchise and cooperative partnerships have tailored commercial terms discussed during onboarding.' },
  { q: 'Which countries are live?', a: 'We’re live across Nigeria with active expansion into Ghana, Kenya, and South Africa. Apply and we’ll tell you what’s available in your area.' },
];

export default function FleetPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Fleet partners', path: '/fleet' }]), faqSchema(faqs)]} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Fleet partners"
          title={<>The delivery network powering Africa’s <span className="text-gradient-spice italic">food creator economy</span> — owned by partners.</>}
          intro="Every meal a creator makes needs to move. We don’t own the bikes — partners do. Get the technology, brand, and order flow to build a real two-wheel delivery business."
          ctas={[
            { label: 'Become a partner', href: '/fleet/apply', variant: 'primary' },
            { label: 'Download the partner kit', href: '/fleet/resources', variant: 'ghost-light' },
          ]}
          image="https://images.unsplash.com/photo-1591768793355-74d04bb6608f?auto=format&fit=crop&w=1600&q=80"
          imageAlt="A motorbike delivery rider on the road"
        />

        {/* Why partner */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="Why partner with FOODS"
              title={<>A partnership built to make you <span className="text-gradient-spice italic">grow</span></>}
              intro="We win when you win. That’s why partners get the full stack — technology, brand, operations, and training — not just a stream of jobs."
            />
            <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {why.map((w, i) => {
                const Icon = w.icon;
                return (
                  <FadeUp key={w.title} delay={(i % 3) * 0.08}>
                    <div className="card p-7 h-full hover:shadow-warm transition-shadow duration-500">
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-xl text-ink mb-2">{w.title}</h3>
                      <p className="text-stone font-light leading-relaxed text-[15px]">{w.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Growth stats */}
        <section className="bg-ink text-cream py-20 grain relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(196,154,60,0.16),transparent_55%)]" />
          <div className="container-x relative grid grid-cols-2 lg:grid-cols-4 gap-10">
            {growthStats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-serif text-[clamp(2rem,4vw,3rem)] text-cream leading-none">
                  <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="mt-3 text-[12px] text-cream/50 font-medium tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Partner types teaser */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading
              kicker="Pathways"
              title={<>A path for every kind of <span className="text-gradient-spice italic">operator</span></>}
              intro="From a single bike to a corporate logistics integration — each pathway has its own requirements, support, and growth ceiling."
            />
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {partnerTypes.map((p, i) => {
                const Icon = p.icon;
                return (
                  <FadeUp key={p.label} delay={i * 0.06}>
                    <Link href={p.href} className="group block card p-6 h-full hover:shadow-warm hover:-translate-y-1 transition-all duration-500">
                      <div className="w-11 h-11 rounded-2xl bg-warm text-spice flex items-center justify-center mb-4 group-hover:bg-spice group-hover:text-cream transition-colors">
                        <Icon size={20} />
                      </div>
                      <p className="text-[14px] font-semibold text-ink leading-snug">{p.label}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-[12px] text-spice font-medium">
                        See requirements <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Link>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Kit CTA */}
        <Section tone="parchment">
          <div className="container-x">
            <div className="card overflow-hidden grid md:grid-cols-2">
              <div className="p-8 sm:p-12">
                <FadeUp>
                  <span className="kicker kicker-dot">Partner kit</span>
                  <h2 className="font-serif text-3xl text-ink mt-5 mb-4">Everything you need to decide, in one kit.</h2>
                  <p className="text-stone font-light leading-relaxed mb-7">
                    The Fleet Partner Guide, Operations Handbook, Territory Guide, Revenue Calculator, and Partnership Deck — branded, downloadable, and built to help you plan a real business.
                  </p>
                  <Link href="/fleet/resources" className="btn-primary">
                    <Download size={16} /> Get the partner kit
                  </Link>
                </FadeUp>
              </div>
              <div className="bg-ink text-cream p-8 sm:p-12 grain relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(200,75,49,0.25),transparent_60%)]" />
                <ul className="relative space-y-4">
                  {['Fleet Partner Guide', 'Operations Handbook', 'Revenue Calculator', 'Territory Guide', 'Franchise Information Pack', 'Partnership Deck'].map((d) => (
                    <li key={d} className="flex items-center gap-3 text-cream/85">
                      <Download size={15} className="text-spice flex-shrink-0" />
                      <span className="font-light">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <Section tone="cream">
          <div className="container-x grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
            <SectionHeading kicker="Questions" title="Fleet partner FAQ" />
            <Accordion items={faqs} />
          </div>
        </Section>

        <CtaBand
          title="Ready to power the network?"
          intro="A five-step application. No long forms. Our partnerships team responds within 48 hours."
          ctas={[
            { label: 'Apply now', href: '/fleet/apply', primary: true },
            { label: 'partnerships@foodsbyme.com', href: 'mailto:partnerships@foodsbyme.com' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
