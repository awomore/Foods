import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Compass, Heart, Flame, ShoppingBag, Users, Bike,
  ArrowRight, Search, Bell, CalendarDays,
} from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import Accordion from '@/components/site/Accordion';
import JsonLd from '@/components/site/JsonLd';
import { AppBadges } from '@/components/site/AppBadges';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { pageMeta, breadcrumbSchema, faqSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'How FOODS works — from craving to community',
  description:
    'Discover creators, follow their kitchens, crave what they cook, order experiences, and join communities. Here is how the FOODS creator food economy works, end to end.',
  path: '/how-it-works',
  keywords: ['how FOODS works', 'follow food creators', 'order from home cooks', 'creator food economy', 'weekly menus Lagos'],
});

const steps = [
  {
    icon: Compass,
    n: '01',
    title: 'Discover creators',
    body: 'Open FOODS and meet the cooks, bakers, and chefs near you. Browse by craving, neighbourhood, or what is trending in your city — every kitchen has a face, a story, and a signature.',
  },
  {
    icon: Heart,
    n: '02',
    title: 'Follow the kitchens you love',
    body: 'Follow a creator and their kitchen becomes part of your feed. See what is cooking today, what drops this weekend, and the dishes their community can not stop ordering.',
  },
  {
    icon: Flame,
    n: '03',
    title: 'Crave what they make next',
    body: 'Creators post the food they are making — not a static catalogue. A craving turns into a tap. Save dishes, set reminders for weekly menus, and never miss a festive box again.',
  },
  {
    icon: ShoppingBag,
    n: '04',
    title: 'Order experiences, not just meals',
    body: 'Order a single dish, reserve a weekly menu, book a private dining experience, buy a course, or grab a digital product. Checkout is fast, secure, and built around the creator.',
  },
  {
    icon: Users,
    n: '05',
    title: 'Join the community',
    body: 'Every creator has a community. Gift meals to people you love, support a creator you believe in, and watch a kitchen grow because of the people who showed up for it.',
  },
];

const forWho = [
  {
    icon: Heart,
    label: 'For customers',
    title: 'Follow kitchens, order experiences',
    body: 'Stop scrolling identical menus. Follow people who cook with a point of view, and taste what they make next.',
    href: '/for-customers',
  },
  {
    icon: Flame,
    label: 'For creators',
    title: 'Build an audience, earn income',
    body: 'Open a kitchen, publish weekly menus, sell courses and products, and turn a following into a real business.',
    href: '/for-creators',
  },
  {
    icon: Bike,
    label: 'For fleet partners',
    title: 'Power the delivery network',
    body: 'Move the food the economy makes. Get the technology, brand, and order flow to build a delivery business.',
    href: '/fleet',
  },
];

const discovery = [
  { icon: Search, title: 'Search by craving', body: 'Jollof at 2pm? Banana bread for Sunday? Search the way you actually crave — by dish, mood, or moment.' },
  { icon: Bell, title: 'Reminders that respect you', body: 'Opt in to a creator’s drops. We nudge you before a weekly menu opens, never to spam you.' },
  { icon: CalendarDays, title: 'Plan your week', body: 'Reserve weekly menus in advance and let your favourite kitchens give your week a rhythm.' },
];

const faqs = [
  { q: 'Is FOODS a delivery app?', a: 'Delivery is part of it, but FOODS is a creator platform first. You follow the people who make the food, see what they are cooking, and order from a relationship — not a faceless menu. Delivery is powered by a network of partner-owned fleets.' },
  { q: 'How is this different from ordering from a restaurant?', a: 'Restaurants upload a fixed menu. Creators post what they are making, drop weekly menus, run courses, sell products, and host private dining. You are following a person and their craft, not browsing a catalogue.' },
  { q: 'What can I actually order?', a: 'Single dishes, reservable weekly menus, private chef experiences, catering, cooking courses, and digital products like recipe guides and spice blends — all from the same creator profile.' },
  { q: 'Where is FOODS available?', a: 'We are live across Nigeria with active expansion into Ghana, Kenya, and South Africa. Open the app to see the creators near you.' },
  { q: 'How do I become a creator or fleet partner?', a: 'Creators can open a kitchen straight from the app. Fleet partners apply through a short five-step form on our Fleet Partners page. Both take minutes to start.' },
];

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'How it works', path: '/how-it-works' }]), faqSchema(faqs)]} />
      <SiteNav />
      <main>
        <PageHero
          kicker="How it works"
          title={<>From a craving to a <span className="text-gradient-spice italic">community</span>, in five moves.</>}
          intro="FOODS is not another delivery app. It is where food creators build audiences, earn income, and grow communities — and where you get to taste the result."
          ctas={[
            { label: 'Get the app', href: '#download', variant: 'primary' },
            { label: 'Explore for creators', href: '/for-creators', variant: 'ghost-light' },
          ]}
        />

        {/* The five steps */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="The journey"
              title={<>Five steps from <span className="text-gradient-spice italic">discovery</span> to belonging</>}
              intro="Every great food relationship on FOODS follows the same arc. Here is what it feels like."
            />
            <div className="mt-16 space-y-4">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <FadeUp key={s.n} delay={(i % 2) * 0.06}>
                    <div className="card p-7 sm:p-9 flex flex-col sm:flex-row gap-6 sm:items-center hover:shadow-warm transition-shadow duration-500">
                      <div className="flex items-center gap-5 sm:w-[42%]">
                        <span className="font-serif text-4xl text-spice/30 leading-none tabular-nums">{s.n}</span>
                        <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0">
                          <Icon size={22} strokeWidth={1.75} />
                        </div>
                        <h3 className="font-serif text-2xl text-ink">{s.title}</h3>
                      </div>
                      <p className="text-stone font-light leading-relaxed text-[15px] sm:flex-1">{s.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Discovery details */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading
              kicker="Discovery, reimagined"
              title={<>Built around how you <span className="text-gradient-spice italic">actually</span> crave</>}
              intro="Most food apps make you do the work. FOODS learns the creators and dishes you love, and brings the right craving to the right moment."
            />
            <div className="mt-14 grid sm:grid-cols-3 gap-6">
              {discovery.map((d, i) => {
                const Icon = d.icon;
                return (
                  <FadeUp key={d.title} delay={i * 0.08}>
                    <div className="card p-7 h-full">
                      <div className="w-12 h-12 rounded-2xl bg-warm text-spice flex items-center justify-center mb-5">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-xl text-ink mb-2">{d.title}</h3>
                      <p className="text-stone font-light leading-relaxed text-[15px]">{d.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Three doors */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="One platform, three roles"
              title={<>However you show up, there is a <span className="text-gradient-spice italic">place for you</span></>}
            />
            <div className="mt-14 grid md:grid-cols-3 gap-6">
              {forWho.map((f, i) => {
                const Icon = f.icon;
                return (
                  <FadeUp key={f.label} delay={i * 0.08}>
                    <Link href={f.href} className="group block card p-8 h-full hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-500">
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-6 group-hover:bg-spice group-hover:text-cream transition-colors">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <p className="kicker kicker-dot mb-3">{f.label}</p>
                      <h3 className="font-serif text-2xl text-ink mb-3">{f.title}</h3>
                      <p className="text-stone font-light leading-relaxed text-[15px] mb-6">{f.body}</p>
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-spice font-medium">
                        Learn more <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    </Link>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Download band */}
        <section className="bg-ink text-cream py-20 md:py-24 grain relative overflow-hidden" id="download">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,rgba(200,75,49,0.2),transparent_55%)]" />
          <div className="container-x relative flex flex-col items-center text-center">
            <FadeUp>
              <h2 className="font-serif text-[clamp(2rem,4.5vw,3.4rem)] leading-tight text-cream max-w-2xl text-balance">
                The whole journey lives in the app.
              </h2>
              <p className="text-cream/60 mt-5 font-light max-w-lg mx-auto">
                Download FOODS, follow your first kitchen, and find your next favourite meal — and the person who makes it.
              </p>
            </FadeUp>
            <FadeUp delay={0.1}>
              <div className="mt-9">
                <AppBadges variant="dark" />
              </div>
            </FadeUp>
          </div>
        </section>

        {/* FAQ */}
        <Section tone="cream">
          <div className="container-x grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
            <SectionHeading kicker="Questions" title="How it works, in detail" />
            <Accordion items={faqs} />
          </div>
        </Section>

        <CtaBand
          title="Find the kitchens worth following."
          intro="Discover creators near you and taste what they make next."
          ctas={[
            { label: 'Get the app', href: '#download', primary: true },
            { label: 'For creators', href: '/for-creators' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
