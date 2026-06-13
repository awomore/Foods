import type { Metadata } from 'next';
import { Flame, Users, Bike, Globe2, Heart, Compass, Sparkles, Scale } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { Counter } from '@/components/ui/Counter';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'About — building the creator food economy',
  description:
    'FOODSbyme is building the digital headquarters of Africa’s creator-commerce food economy. Our vision, our values, and why we believe food creators deserve infrastructure.',
  path: '/about',
  keywords: ['about FOODSbyme', 'creator food economy', 'food startup Africa', 'mission', 'vision'],
});

const values = [
  { icon: Flame, title: 'Creators first', body: 'The person who makes the food is the point. Every decision starts with whether it helps a creator build something real.' },
  { icon: Heart, title: 'Food is culture', body: 'We treat African food as the rich, living culture it is — not a commodity to be flattened into a faceless menu.' },
  { icon: Scale, title: 'Wealth, not gigs', body: 'We build models that let people own and grow — creators and fleet partners alike — instead of extracting from them.' },
  { icon: Compass, title: 'Built in Africa, for the world', body: 'We start where food culture is richest and the opportunity is largest, and we build to a global standard.' },
];

const stats = [
  { value: 4200, suffix: '+', label: 'Food creators' },
  { value: 380, suffix: 'k+', label: 'Community members' },
  { value: 12, label: 'Cities and growing' },
  { value: 96, suffix: '%', label: 'On-time delivery' },
];

const pillars = [
  { icon: Flame, title: 'Creators', body: 'Cooks, bakers, pastry chefs, and food entrepreneurs who build audiences and earn from their craft.' },
  { icon: Users, title: 'Communities', body: 'The followers, regulars, and gift-givers who turn a kitchen into a movement.' },
  { icon: Bike, title: 'Fleet partners', body: 'The thousands of partner-owned bikes and fleets that move every meal the economy makes.' },
  { icon: Globe2, title: 'Infrastructure', body: 'The technology, payments, logistics, and APIs that make all of it run — quietly, reliably.' },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="About"
          title={<>We’re building the home of Africa’s <span className="text-gradient-spice italic">creator food economy.</span></>}
          intro="Not another delivery app — the digital headquarters of a new economy, where food creators build audiences, earn income, and grow communities."
          image="https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=1600&q=80"
          imageAlt="A bustling kitchen at service"
        />

        {/* Manifesto */}
        <Section tone="parchment">
          <div className="container-narrow text-center">
            <FadeUp>
              <span className="kicker kicker-dot justify-center">The belief</span>
            </FadeUp>
            <FadeUp delay={0.06}>
              <p className="font-serif text-[clamp(1.7rem,3.4vw,2.6rem)] leading-snug text-ink mt-6 text-balance">
                Food is the most universal form of culture in Africa. We think the people who make it should be able to build audiences and businesses around it — the way creators do everywhere else.
              </p>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mt-8 text-stone font-light leading-relaxed text-lg max-w-2xl mx-auto text-pretty">
                For most of the last decade, food apps treated cooking as a commodity. A restaurant uploaded a menu, a customer tapped a button, a rider carried a bag — and the person who actually made the food was invisible. We think that’s backwards. The most talented cooks aren’t interchangeable. They have a hand, a story, a signature. FOODS is built on a simple idea: food is creator content, and creators deserve infrastructure.
              </p>
            </FadeUp>
          </div>
        </Section>

        {/* Stats */}
        <section className="bg-ink text-cream py-16 grain relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(200,75,49,0.16),transparent_55%)]" />
          <div className="container-x relative grid grid-cols-2 lg:grid-cols-4 gap-10">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-serif text-[clamp(2rem,4vw,3rem)] text-cream leading-none">
                  <Counter to={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-3 text-[12px] text-cream/50 font-medium tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What we're building */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="What we’re building"
              title={<>Four parts, one <span className="text-gradient-spice italic">economy</span></>}
              intro="FOODS only works when all four reinforce each other. That’s the flywheel we’re building."
            />
            <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {pillars.map((p, i) => {
                const Icon = p.icon;
                return (
                  <FadeUp key={p.title} delay={i * 0.07}>
                    <div className="card p-7 h-full">
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-xl text-ink mb-2">{p.title}</h3>
                      <p className="text-stone font-light leading-relaxed text-[14px]">{p.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Values */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              kicker="What we value"
              title={<>The principles we <span className="text-gradient-spice italic">build by</span></>}
            />
            <div className="mt-14 grid sm:grid-cols-2 gap-6">
              {values.map((v, i) => {
                const Icon = v.icon;
                return (
                  <FadeUp key={v.title} delay={(i % 2) * 0.08}>
                    <div className="card p-8 h-full flex gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-warm text-spice flex items-center justify-center flex-shrink-0">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl text-ink mb-2">{v.title}</h3>
                        <p className="text-stone font-light leading-relaxed text-[15px]">{v.body}</p>
                      </div>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Vision band */}
        <Section tone="ink">
          <div className="container-x grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
            <FadeUp>
              <Sparkles size={36} className="text-spice mb-5" />
              <h2 className="font-serif text-[clamp(2rem,4vw,3rem)] leading-tight text-cream text-balance">
                A continent of food creators, earning what they’re worth.
              </h2>
            </FadeUp>
            <FadeUp delay={0.1}>
              <div className="space-y-5 text-cream/65 font-light text-lg leading-relaxed">
                <p>
                  We imagine a Lagos where a Sunday cook becomes a household name. An Accra where a baker funds a storefront from her following. A Nairobi where a single bike grows into a fleet that employs a neighbourhood.
                </p>
                <p>
                  The creator economy reshaped music, writing, and video. We’re bringing it to the table — and building the infrastructure so the value flows to the people who make and move the food.
                </p>
              </div>
            </FadeUp>
          </div>
        </Section>

        <CtaBand
          title="Come build the future of food with us."
          intro="Whether you cook, deliver, invest, or just love good food — there’s a place for you here."
          ctas={[
            { label: 'See open roles', href: '/careers', primary: true },
            { label: 'Get in touch', href: '/contact' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
