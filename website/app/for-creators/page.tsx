import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Store, CalendarRange, GraduationCap, Package, ChefHat, Gift,
  Wallet, BarChart3, ShieldCheck, Megaphone, ArrowRight, Quote,
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
import { Counter } from '@/components/ui/Counter';
import { TESTIMONIALS } from '@/lib/data';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema, faqSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'For creators — build an audience and earn from your food',
  description:
    'Open a kitchen on FOODS. Build a following, publish weekly menus, sell courses and digital products, host private dining, and earn real, compounding income from your cooking.',
  path: '/for-creators',
  keywords: ['become a food creator', 'sell food online Nigeria', 'home cook business Lagos', 'food entrepreneur', 'weekly menus', 'cooking courses', 'private chef bookings'],
});

const earn = [
  { icon: Store, title: 'Your own storefront', body: 'A profile that is unmistakably yours — story, signature dishes, followers, and a feed of what you are cooking now.' },
  { icon: CalendarRange, title: 'Weekly menus', body: 'Publish a fixed drop your community plans their week around. Turn random orders into a reliable rhythm.' },
  { icon: ChefHat, title: 'Private chef & catering', body: 'Take bookings for private dining, events, and catering — priced, scheduled, and paid through your profile.' },
  { icon: GraduationCap, title: 'Courses', body: 'Teach your craft. Package a recipe or technique into a course and earn while you sleep.' },
  { icon: Package, title: 'Digital & physical products', body: 'Sell spice blends, recipe guides, grazing boxes, and merch — new revenue beyond the plate.' },
  { icon: Gift, title: 'Community gifting', body: 'Let your community gift your meals to others. Generosity that grows your reach and your income.' },
];

const tools = [
  { icon: Wallet, title: 'Fast, transparent payouts', body: 'Earnings settle to your account on a clear cycle. See pending and paid in real time — no mystery deductions.' },
  { icon: BarChart3, title: 'Creator analytics', body: 'Know what your community loves. Track followers, repeat orders, top dishes, and revenue trends.' },
  { icon: ShieldCheck, title: 'Trust & safety built in', body: 'Verified profiles, secure checkout, and a dispute process that protects you and your customers.' },
  { icon: Megaphone, title: 'Discovery & growth', body: 'Get surfaced to the right cravings in your city. Share your profile, dishes, and menus with beautiful preview cards.' },
];

const startSteps = [
  { n: '01', title: 'Open your kitchen', body: 'Download FOODS, set up your profile, and tell your story. It takes minutes — no website, no storefront to build.' },
  { n: '02', title: 'Post what you cook', body: 'Share dishes, drop your first weekly menu, and let people follow along. Consistency builds the following.' },
  { n: '03', title: 'Get discovered', body: 'Your kitchen surfaces to nearby cravings. Followers turn into regulars, regulars into a community.' },
  { n: '04', title: 'Grow your income', body: 'Layer on courses, products, catering, and private dining. Turn a passion into compounding revenue.' },
];

const stats = [
  { value: 4200, suffix: '+', label: 'Creators building on FOODS' },
  { value: 1.2, prefix: '₦', suffix: 'M', decimals: 1, label: 'Avg. top-creator monthly revenue' },
  { value: 8, label: 'Income streams from one profile' },
  { value: 96, suffix: '%', label: 'Orders delivered on time' },
];

const faqs = [
  { q: 'Do I need a restaurant or commercial kitchen?', a: 'No. Most FOODS creators start from a home kitchen. You do need to meet basic food-safety standards, which we walk you through during onboarding. The point is to let talented cooks build a business without the overhead of a restaurant.' },
  { q: 'How much does it cost to start?', a: 'Opening a kitchen is free. FOODS earns a transparent service fee on orders — there are no upfront costs, no subscription, and no charge to publish menus, courses, or products.' },
  { q: 'How and when do I get paid?', a: 'Earnings accrue per order and settle to your registered account on a regular cycle. Your dashboard shows pending and paid balances in real time, with a full breakdown per order.' },
  { q: 'Can I do this part-time?', a: 'Absolutely. Many creators start with a single weekly menu on Sundays and grow from there. You control your menu, your capacity, and your schedule.' },
  { q: 'What support do I get?', a: 'Onboarding help, food-safety guidance, creator analytics, marketing tools, and a support team that responds. As you grow, you get access to features like courses, catering, and private dining.' },
  { q: 'Who handles delivery?', a: 'A network of partner-owned fleets. You focus on the food — order assignment, tracking, and delivery are handled by the platform and our fleet partners.' },
];

export default function ForCreatorsPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'For creators', path: '/for-creators' }]), faqSchema(faqs)]} />
      <SiteNav />
      <main>
        <PageHero
          kicker="For creators"
          title={<>Turn what you cook into an <span className="text-gradient-spice italic">audience</span> and an income.</>}
          intro="Open a kitchen, build a following, and earn from weekly menus, courses, products, catering, and private dining — all from one profile. This is the creator economy, for food."
          ctas={[
            { label: 'Open your kitchen', href: '#start', variant: 'primary' },
            { label: 'See success stories', href: '#stories', variant: 'ghost-light' },
          ]}
          image="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1600&q=80"
          imageAlt="A chef plating a dish in a home kitchen"
        />

        {/* Stats */}
        <section className="bg-charcoal text-cream py-16 grain relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(200,75,49,0.16),transparent_55%)]" />
          <div className="container-x relative grid grid-cols-2 lg:grid-cols-4 gap-10">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-serif text-[clamp(2rem,4vw,3rem)] text-cream leading-none">
                  <Counter to={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
                </p>
                <p className="mt-3 text-[12px] text-cream/50 font-medium tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ways to earn */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="Ways to earn"
              title={<>One kitchen. <span className="text-gradient-spice italic">Many</span> ways to earn.</>}
              intro="Delivery fees are a race to the bottom. FOODS gives you the building blocks that let creators everywhere build careers — applied to food."
            />
            <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {earn.map((e, i) => {
                const Icon = e.icon;
                return (
                  <FadeUp key={e.title} delay={(i % 3) * 0.08}>
                    <div className="card p-7 h-full hover:shadow-warm transition-shadow duration-500">
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-xl text-ink mb-2">{e.title}</h3>
                      <p className="text-stone font-light leading-relaxed text-[15px]">{e.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Tools */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading
              kicker="The toolkit"
              title={<>Everything you need to run a <span className="text-gradient-spice italic">real business</span></>}
              intro="Not just a place to list food — a complete operating system for your kitchen."
            />
            <div className="mt-14 grid sm:grid-cols-2 gap-6">
              {tools.map((t, i) => {
                const Icon = t.icon;
                return (
                  <FadeUp key={t.title} delay={(i % 2) * 0.08}>
                    <div className="card p-7 h-full flex gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-warm text-spice flex items-center justify-center flex-shrink-0">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl text-ink mb-2">{t.title}</h3>
                        <p className="text-stone font-light leading-relaxed text-[15px]">{t.body}</p>
                      </div>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* How to start */}
        <Section tone="parchment" id="start">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="Getting started"
              title={<>From first post to full-time, <span className="text-gradient-spice italic">step by step</span></>}
            />
            <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {startSteps.map((s, i) => (
                <FadeUp key={s.n} delay={i * 0.08}>
                  <div className="h-full">
                    <span className="font-serif text-5xl text-spice/25 leading-none tabular-nums">{s.n}</span>
                    <h3 className="font-serif text-xl text-ink mt-4 mb-2">{s.title}</h3>
                    <p className="text-stone font-light leading-relaxed text-[15px]">{s.body}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={0.1}>
              <div className="mt-14 flex justify-center">
                <AppBadges />
              </div>
            </FadeUp>
          </div>
        </Section>

        {/* Success story spotlight */}
        <Section tone="ink" id="stories">
          <div className="container-x grid lg:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <div className="relative aspect-[4/3] rounded-3xl overflow-hidden">
                <Image
                  src="https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80"
                  alt="Mama Titi's smoky party jollof"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </FadeUp>
            <div>
              <FadeUp>
                <Quote size={36} className="text-spice mb-5" />
                <blockquote className="font-serif text-[clamp(1.5rem,3vw,2.2rem)] leading-snug text-cream text-balance">
                  “I started posting what I cooked on Sundays. Eight months later FOODS is my full-time income — I have regulars who plan their week around my menu.”
                </blockquote>
              </FadeUp>
              <FadeUp delay={0.1}>
                <div className="mt-7 flex items-center gap-4">
                  <Image
                    src="/images/creators/titilayo.webp"
                    alt="Titilayo Adeyemi"
                    width={52}
                    height={52}
                    className="rounded-full object-cover"
                  />
                  <div>
                    <p className="text-cream font-medium">Titilayo Adeyemi</p>
                    <p className="text-cream/50 text-sm">Mama Titi’s Kitchen · 24k followers</p>
                  </div>
                </div>
              </FadeUp>
              <FadeUp delay={0.16}>
                <Link href="/blog/how-mama-titi-turned-sunday-cooking-into-a-business" className="mt-8 inline-flex items-center gap-1.5 text-spice font-medium text-[15px] hover:gap-2.5 transition-all">
                  Read her full story <ArrowRight size={16} />
                </Link>
              </FadeUp>
            </div>
          </div>
        </Section>

        {/* More voices */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading align="center" kicker="In their words" title="Creators, customers, and partners" />
            <div className="mt-14 grid md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t, i) => (
                <FadeUp key={t.name} delay={i * 0.08}>
                  <figure className="card p-7 h-full flex flex-col">
                    <Quote size={24} className="text-spice mb-4" />
                    <blockquote className="text-ink/90 font-light leading-relaxed text-[15px] flex-1">{t.quote}</blockquote>
                    <figcaption className="mt-6 flex items-center gap-3">
                      <Image src={t.avatar} alt={t.name} width={40} height={40} className="rounded-full object-cover" />
                      <div>
                        <p className="text-ink text-sm font-medium">{t.name}</p>
                        <p className="text-muted text-xs">{t.role}</p>
                      </div>
                    </figcaption>
                  </figure>
                </FadeUp>
              ))}
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <Section tone="parchment">
          <div className="container-x grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
            <SectionHeading kicker="Questions" title="Creator FAQ" />
            <Accordion items={faqs} />
          </div>
        </Section>

        <CtaBand
          title="Your kitchen is your business. Start it today."
          intro="Opening a kitchen is free and takes minutes. Build a following, earn real income, and grow a community around your food."
          ctas={[
            { label: 'Open your kitchen', href: SITE.app.ios, primary: true },
            { label: 'Talk to the creator team', href: `mailto:${SITE.email.creators}` },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
