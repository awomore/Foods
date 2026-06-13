import type { Metadata } from 'next';
import { Mail, MapPin, Phone, Flame, Bike, Newspaper, LifeBuoy } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import JsonLd from '@/components/site/JsonLd';
import ContactForm from '@/components/site/ContactForm';
import { Section } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Contact — talk to the right team, fast',
  description:
    'Get in touch with FOODSbyme. Reach the team for general enquiries, creators, fleet partnerships, press, and order support.',
  path: '/contact',
  keywords: ['contact FOODSbyme', 'partnerships email', 'creator support', 'press contact', 'customer support Lagos'],
});

const channels = [
  { icon: Flame, title: 'Creators', desc: 'Open a kitchen or get creator support.', email: SITE.email.creators },
  { icon: Bike, title: 'Fleet & partnerships', desc: 'Become a partner or explore enterprise.', email: SITE.email.partnerships },
  { icon: Newspaper, title: 'Press & media', desc: 'Interviews, data, and media kit.', email: SITE.email.press },
  { icon: LifeBuoy, title: 'Order support', desc: 'Help with a live or recent order.', email: SITE.email.support },
];

export default function ContactPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Contact"
          title={<>Let’s <span className="text-gradient-spice italic">talk.</span></>}
          intro="Whether you cook, deliver, write, or just need a hand with an order — there’s a team ready to help. Pick a topic and we’ll route it right."
        />

        <Section tone="parchment">
          <div className="container-x grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-start">
            {/* Left: details */}
            <div>
              <FadeUp>
                <h2 className="font-serif text-2xl md:text-3xl text-ink mb-2">Reach the right team</h2>
                <p className="text-stone font-light leading-relaxed mb-8 max-w-md">
                  Use the form, or email any team directly. For anything happening with a live order, the in-app support chat is the fastest route.
                </p>
              </FadeUp>

              <FadeUp delay={0.06}>
                <div className="space-y-3 mb-8">
                  <a href={`mailto:${SITE.email.hello}`} className="flex items-center gap-4 group">
                    <span className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0">
                      <Mail size={19} />
                    </span>
                    <span>
                      <span className="block text-[12px] text-muted">General enquiries</span>
                      <span className="block text-ink font-medium group-hover:text-spice transition-colors">{SITE.email.hello}</span>
                    </span>
                  </a>
                  <a href={SITE.phone.href} className="flex items-center gap-4 group">
                    <span className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0">
                      <Phone size={19} />
                    </span>
                    <span>
                      <span className="block text-[12px] text-muted">Phone</span>
                      <span className="block text-ink font-medium group-hover:text-spice transition-colors">{SITE.phone.display}</span>
                    </span>
                  </a>
                  <div className="flex items-center gap-4">
                    <span className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0">
                      <MapPin size={19} />
                    </span>
                    <span>
                      <span className="block text-[12px] text-muted">Office</span>
                      <span className="block text-ink font-medium">{SITE.address.street}, {SITE.address.city}</span>
                    </span>
                  </div>
                </div>
              </FadeUp>

              <FadeUp delay={0.12}>
                <div className="grid sm:grid-cols-2 gap-3">
                  {channels.map((c) => {
                    const Icon = c.icon;
                    return (
                      <a key={c.title} href={`mailto:${c.email}`} className="group card p-5 hover:shadow-warm transition-all duration-500">
                        <div className="w-10 h-10 rounded-xl bg-warm text-spice flex items-center justify-center mb-3 group-hover:bg-spice group-hover:text-cream transition-colors">
                          <Icon size={18} />
                        </div>
                        <p className="text-[14px] font-semibold text-ink">{c.title}</p>
                        <p className="text-[12px] text-muted mt-0.5">{c.desc}</p>
                        <p className="text-[12px] text-spice font-medium mt-2">{c.email}</p>
                      </a>
                    );
                  })}
                </div>
              </FadeUp>
            </div>

            {/* Right: form */}
            <FadeUp delay={0.1}>
              <ContactForm />
            </FadeUp>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
