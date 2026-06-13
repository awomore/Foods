import type { Metadata } from 'next';
import {
  Gift, Users, HeartHandshake, Sparkles, MessageCircle, Trophy,
  HandHeart, Globe2,
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
  title: 'Communities — food that brings people together',
  description:
    'On FOODS, every creator has a community. Gift meals, support kitchens you believe in, celebrate together, and turn food into belonging across Africa.',
  path: '/communities',
  keywords: ['food community', 'gift a meal', 'support local cooks', 'community gifting', 'creator community Africa'],
});

const pillars = [
  { icon: Gift, title: 'Community gifting', body: 'Send a meal to someone you love, or to someone who needs one. Gifting turns a single order into an act of care — and grows the creator’s reach.' },
  { icon: Users, title: 'Creator communities', body: 'Every kitchen has a community of regulars, super-fans, and first-timers. Follow, comment, and belong to the kitchens you love.' },
  { icon: HeartHandshake, title: 'Support that compounds', body: 'When you back a creator, you’re backing a small business. Repeat orders and gifts are how a Sunday hobby becomes a full-time income.' },
  { icon: Trophy, title: 'Celebrate the moments', body: 'Birthdays, festivals, naming ceremonies, and ordinary Tuesdays. Food is how we mark life — FOODS makes it shareable.' },
];

const ways = [
  { icon: HandHeart, title: 'Gift a single meal', body: 'Pick a dish, add a note, and send it to a friend, a family member, or someone having a hard week.' },
  { icon: Sparkles, title: 'Fund a community drop', body: 'Pool with others to sponsor a creator’s community meal — neighbourhood, workplace, or cause.' },
  { icon: MessageCircle, title: 'Show up in the comments', body: 'Reactions, reviews, and shout-outs. The smallest support tells a creator their work matters.' },
  { icon: Globe2, title: 'Spread the word', body: 'Share a creator’s profile, dish, or menu with a beautiful preview card — discovery is the best gift.' },
];

const stats = [
  { value: 380, suffix: 'k+', label: 'Community members' },
  { value: 52, suffix: 'k+', label: 'Meals gifted to date' },
  { value: 4200, suffix: '+', label: 'Creator communities' },
  { value: 12, label: 'Cities and growing' },
];

const faqs = [
  { q: 'What does “community gifting” mean?', a: 'You can buy a meal and send it to someone else — a friend, family member, or someone in need — directly through the app. The recipient gets the food; the creator gets a new customer and wider reach.' },
  { q: 'Can businesses or groups gift at scale?', a: 'Yes. Workplaces, churches, associations, and organisations can fund community drops — sponsoring meals from a creator for a group or a cause. Reach out and we’ll help you set it up.' },
  { q: 'How does this help creators?', a: 'Communities are how creators grow. Gifts introduce a kitchen to new people, repeat support builds reliable income, and engaged followers turn a hobby into a business.' },
  { q: 'Is gifting available everywhere FOODS is?', a: 'Gifting is available across our live cities and rolls out alongside delivery. Open the app to see what’s available in your area.' },
];

export default function CommunitiesPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Communities', path: '/communities' }]), faqSchema(faqs)]} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Communities"
          title={<>Food is how we <span className="text-gradient-spice italic">belong.</span></>}
          intro="Behind every kitchen on FOODS is a community of people who show up — ordering, gifting, and celebrating together. This is where food becomes more than a meal."
          ctas={[
            { label: 'Get the app', href: SITE_IOS, variant: 'primary' },
            { label: 'For creators', href: '/for-creators', variant: 'ghost-light' },
          ]}
          image="https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1600&q=80"
          imageAlt="People sharing a meal together"
        />

        {/* Stats */}
        <section className="bg-charcoal text-cream py-16 grain relative overflow-hidden">
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

        {/* Pillars */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="What community means here"
              title={<>More than a transaction — a <span className="text-gradient-spice italic">relationship</span></>}
              intro="The creator economy is built on community. For food, that community is the difference between a one-off order and a kitchen people love."
            />
            <div className="mt-16 grid sm:grid-cols-2 gap-6">
              {pillars.map((p, i) => {
                const Icon = p.icon;
                return (
                  <FadeUp key={p.title} delay={(i % 2) * 0.08}>
                    <div className="card p-8 h-full flex gap-5 hover:shadow-warm transition-shadow duration-500">
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="font-serif text-xl text-ink mb-2">{p.title}</h3>
                        <p className="text-stone font-light leading-relaxed text-[15px]">{p.body}</p>
                      </div>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Gifting feature */}
        <Section tone="ink">
          <div className="container-x grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <FadeUp>
                <span className="kicker kicker-dot">Community gifting</span>
                <h2 className="font-serif text-[clamp(2rem,4vw,3rem)] leading-tight text-cream mt-5 text-balance">
                  Give a meal. Grow a kitchen. Both at once.
                </h2>
                <p className="text-cream/65 font-light leading-relaxed mt-5 text-lg">
                  Gifting is the most generous thing you can do on FOODS — and the most powerful way to help a creator grow. Every gift feeds someone and introduces a kitchen to a new face.
                </p>
              </FadeUp>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {ways.map((w, i) => {
                const Icon = w.icon;
                return (
                  <FadeUp key={w.title} delay={i * 0.07}>
                    <div className="rounded-3xl border border-cream/12 bg-cream/[0.04] p-6 h-full">
                      <div className="w-11 h-11 rounded-2xl bg-spice/15 text-spice flex items-center justify-center mb-4">
                        <Icon size={20} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-lg text-cream mb-1.5">{w.title}</h3>
                      <p className="text-cream/55 font-light text-[14px] leading-relaxed">{w.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Quote */}
        <Section tone="cream">
          <div className="container-x">
            <FadeUp>
              <blockquote className="max-w-3xl mx-auto text-center">
                <p className="font-serif text-[clamp(1.6rem,3.4vw,2.6rem)] leading-snug text-ink text-balance">
                  “It doesn’t feel like ordering food. It feels like following someone you believe in, and getting to taste what they make.”
                </p>
                <footer className="mt-6 text-muted text-sm">Daniel Okafor · Customer, Nigeria</footer>
              </blockquote>
            </FadeUp>
          </div>
        </Section>

        {/* FAQ */}
        <Section tone="parchment">
          <div className="container-x grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
            <SectionHeading kicker="Questions" title="Community FAQ" />
            <Accordion items={faqs} />
          </div>
        </Section>

        <CtaBand
          title="Be the reason a kitchen grows."
          intro="Follow a creator, gift a meal, and join a community built around food and the people who make it."
          ctas={[
            { label: 'Get the app', href: SITE_IOS, primary: true },
            { label: 'Fund a community drop', href: 'mailto:hello@foodsbyme.com?subject=Community%20gifting%20for%20groups' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}

const SITE_IOS = 'https://apps.apple.com/app/foodsbyme';
