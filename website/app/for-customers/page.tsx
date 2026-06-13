import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  Heart, Sparkles, ShieldCheck, Clock, Gift, Star,
  CalendarRange, ChefHat, Search,
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
import { CREATORS } from '@/lib/data';
import { pageMeta, breadcrumbSchema, faqSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'For customers — follow the kitchens you love',
  description:
    'Discover food creators near you, follow their kitchens, reserve weekly menus, book private dining, and gift meals to people you love. Ordering, but personal.',
  path: '/for-customers',
  keywords: ['order food Lagos', 'follow home cooks', 'weekly menu reservation', 'private chef booking', 'gift meals', 'food delivery Lagos'],
});

const why = [
  { icon: Heart, title: 'Follow, don’t just order', body: 'Build relationships with the people who cook for you. Their kitchen lives in your feed, so you always know what’s next.' },
  { icon: Sparkles, title: 'Discover real signatures', body: 'Not another grid of identical menus. Find cooks with a hand and a story — and dishes you can’t get anywhere else.' },
  { icon: CalendarRange, title: 'Reserve weekly menus', body: 'Plan your week around the kitchens you love. Reserve a Sunday drop and never miss the dish you crave.' },
  { icon: ChefHat, title: 'Book experiences', body: 'Beyond a meal — book private dining, order catering for an event, take a course, or buy a creator’s products.' },
  { icon: Gift, title: 'Gift meals you believe in', body: 'Send a meal to someone you love, or support a creator’s community. Generosity, one plate at a time.' },
  { icon: ShieldCheck, title: 'Order with confidence', body: 'Verified creators, secure payment, live tracking, and real support if anything goes wrong.' },
];

const flow = [
  { icon: Search, title: 'Find your craving', body: 'Search by dish, mood, or neighbourhood — or just see what’s trending near you right now.' },
  { icon: Heart, title: 'Follow the kitchen', body: 'Like what you see? Follow, and their drops, menus, and stories appear in your feed.' },
  { icon: Clock, title: 'Order & track', body: 'Tap to order a dish or reserve a menu. Track it live, delivered by a trusted fleet partner.' },
];

const faqs = [
  { q: 'How is FOODS different from other delivery apps?', a: 'You follow people, not restaurants. Creators post what they’re actually cooking, drop weekly menus, run courses, and host private dining. It feels less like ordering and more like following someone whose food you believe in.' },
  { q: 'Is the food safe and the creator verified?', a: 'Yes. Creators are verified, held to food-safety standards, and rated by their community. Secure payment and a clear dispute process protect every order.' },
  { q: 'What is a weekly menu?', a: 'A fixed drop a creator publishes on a schedule — say, every Sunday. You can reserve in advance so you never miss it, and it gives your favourite kitchens a rhythm you can plan around.' },
  { q: 'Can I gift a meal to someone else?', a: 'Yes. Community gifting lets you send a meal to someone you love or support a creator’s community fund. They get the food; the creator grows their reach.' },
  { q: 'How fast is delivery?', a: 'Median delivery is around 18 minutes, with 96% of orders arriving on time. Every delivery is tracked live and handled by a vetted fleet partner.' },
  { q: 'Where can I use FOODS?', a: 'Live across Lagos, expanding into Abuja, Port Harcourt, Ibadan, Accra, and Nairobi. Open the app to see the creators near you.' },
];

export default function ForCustomersPage() {
  return (
    <>
      <JsonLd data={[breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'For customers', path: '/for-customers' }]), faqSchema(faqs)]} />
      <SiteNav />
      <main>
        <PageHero
          kicker="For customers"
          title={<>Follow the kitchens you love. Taste what they <span className="text-gradient-spice italic">make next.</span></>}
          intro="Discover food creators near you, follow their kitchens, reserve weekly menus, and order experiences — not just meals. Ordering, finally made personal."
          ctas={[
            { label: 'Get the app', href: '#download', variant: 'primary' },
            { label: 'How it works', href: '/how-it-works', variant: 'ghost-light' },
          ]}
          image="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80"
          imageAlt="A spread of West African dishes"
        />

        {/* Why */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="Why you’ll love it"
              title={<>A better way to <span className="text-gradient-spice italic">crave</span></>}
              intro="FOODS turns ordering food into following the people who make it — with all the joy and none of the sameness."
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

        {/* Featured creators */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading
              kicker="Near you"
              title={<>Kitchens worth <span className="text-gradient-spice italic">following</span></>}
              intro="A taste of the creators building on FOODS. Every one has a signature, a story, and a community."
            />
            <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CREATORS.map((c, i) => (
                <FadeUp key={c.handle} delay={(i % 3) * 0.07}>
                  <div className="card overflow-hidden h-full hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-500">
                    <div className="relative aspect-[4/3]">
                      <Image src={c.image} alt={c.specialty} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover" />
                      <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-ink/70 backdrop-blur-sm px-2.5 py-1 text-cream text-[12px] font-medium">
                        <Star size={12} className="text-gold fill-gold" /> {c.rating.toFixed(1)}
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Image src={c.avatar} alt={c.name} width={40} height={40} className="rounded-full object-cover" />
                        <div>
                          <p className="text-ink font-semibold text-[15px] leading-tight">{c.kitchen}</p>
                          <p className="text-muted text-[12px]">{c.handle} · {c.city}</p>
                        </div>
                      </div>
                      <p className="text-stone font-light text-[14px] leading-relaxed mb-4">{c.specialty}</p>
                      <div className="flex flex-wrap gap-2">
                        {c.tags.map((t) => (
                          <span key={t} className="text-[11px] font-medium text-stone bg-warm rounded-full px-2.5 py-1">{t}</span>
                        ))}
                      </div>
                      <p className="mt-4 text-[12px] text-muted">{c.followers} followers</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
            <p className="text-center text-muted text-sm mt-10">Thousands more in the app, near you.</p>
          </div>
        </Section>

        {/* Flow */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading align="center" kicker="Three taps" title={<>From craving to <span className="text-gradient-spice italic">doorstep</span></>} />
            <div className="mt-16 grid sm:grid-cols-3 gap-6">
              {flow.map((f, i) => {
                const Icon = f.icon;
                return (
                  <FadeUp key={f.title} delay={i * 0.08}>
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mx-auto mb-5">
                        <Icon size={24} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-xl text-ink mb-2">{f.title}</h3>
                      <p className="text-stone font-light leading-relaxed text-[15px] max-w-xs mx-auto">{f.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Download */}
        <section className="bg-ink text-cream py-20 md:py-24 grain relative overflow-hidden" id="download">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(200,75,49,0.2),transparent_55%)]" />
          <div className="container-x relative flex flex-col items-center text-center">
            <FadeUp>
              <h2 className="font-serif text-[clamp(2rem,4.5vw,3.4rem)] leading-tight text-cream max-w-2xl text-balance">
                Your next favourite meal is one follow away.
              </h2>
              <p className="text-cream/60 mt-5 font-light max-w-lg mx-auto">
                Download FOODS, discover the creators near you, and start following the kitchens you’ll come back to.
              </p>
            </FadeUp>
            <FadeUp delay={0.1}>
              <div className="mt-9"><AppBadges variant="dark" /></div>
            </FadeUp>
          </div>
        </section>

        {/* FAQ */}
        <Section tone="cream">
          <div className="container-x grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
            <SectionHeading kicker="Questions" title="Customer FAQ" />
            <Accordion items={faqs} />
          </div>
        </Section>

        <CtaBand
          title="Eat like you follow the cook. Because you do."
          intro="Discover creators near you and taste what they make next."
          ctas={[
            { label: 'Get the app', href: '#download', primary: true },
            { label: 'Explore communities', href: '/communities' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
