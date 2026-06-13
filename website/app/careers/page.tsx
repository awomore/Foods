import type { Metadata } from 'next';
import { ArrowUpRight, Heart, Rocket, Globe2, Scale, Users, Laptop } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { JOBS } from '@/lib/data';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Careers — build the future of food with us',
  description:
    'Join FOODSbyme and help build the creator food economy. Open roles across engineering, design, growth, operations, and community — in Lagos and remote.',
  path: '/careers',
  keywords: ['FOODSbyme careers', 'jobs Lagos startup', 'food tech jobs Africa', 'remote engineering jobs Nigeria'],
});

const perks = [
  { icon: Rocket, title: 'Real ownership', body: 'Meaningful equity and the autonomy to do the best work of your career on a problem that matters.' },
  { icon: Globe2, title: 'Remote-friendly', body: 'Work from Lagos or anywhere your timezone overlaps. We optimise for output, not seat time.' },
  { icon: Heart, title: 'Health & wellbeing', body: 'Comprehensive health cover for you and your family, plus generous, genuinely-taken leave.' },
  { icon: Laptop, title: 'Top-tier tools', body: 'The hardware, software, and budget you need to move fast and build things you’re proud of.' },
  { icon: Users, title: 'A team that cares', body: 'Small, senior, and kind. We give direct feedback, ship together, and celebrate the wins.' },
  { icon: Scale, title: 'Impact you can see', body: 'Your work changes how thousands of creators and partners earn a living. The feedback is immediate.' },
];

// Group jobs by team for a clean listing.
const teams = Array.from(new Set(JOBS.map((j) => j.team)));

export default function CareersPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Careers', path: '/careers' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Careers"
          title={<>Build the future of food, with people who <span className="text-gradient-spice italic">care.</span></>}
          intro="We’re a small, senior team building the infrastructure for Africa’s creator food economy. If that excites you, we should talk."
          ctas={[{ label: 'See open roles', href: '#roles', variant: 'primary' }]}
          image="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80"
          imageAlt="A team collaborating"
        />

        {/* Perks */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              align="center"
              kicker="Why join us"
              title={<>Senior work, real ownership, <span className="text-gradient-spice italic">visible impact</span></>}
              intro="We hire experienced people, give them room, and back them. Here’s what that comes with."
            />
            <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {perks.map((p, i) => {
                const Icon = p.icon;
                return (
                  <FadeUp key={p.title} delay={(i % 3) * 0.08}>
                    <div className="card p-7 h-full hover:shadow-warm transition-shadow duration-500">
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center mb-5">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <h3 className="font-serif text-xl text-ink mb-2">{p.title}</h3>
                      <p className="text-stone font-light leading-relaxed text-[15px]">{p.body}</p>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Open roles */}
        <Section tone="cream" id="roles">
          <div className="container-x">
            <SectionHeading
              kicker="Open roles"
              title={<>Find your <span className="text-gradient-spice italic">seat</span></>}
              intro="Don’t see an exact fit? We always want to hear from exceptional people — write to us anyway."
            />
            <div className="mt-12 space-y-12">
              {teams.map((team) => (
                <div key={team}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted mb-4">{team}</h3>
                  <div className="rounded-3xl border border-border overflow-hidden divide-y divide-border bg-parchment">
                    {JOBS.filter((j) => j.team === team).map((job) => (
                      <a
                        key={job.title}
                        href={`mailto:${SITE.email.careers}?subject=${encodeURIComponent(`Application — ${job.title}`)}`}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 hover:bg-warm/50 transition-colors"
                      >
                        <div>
                          <p className="font-serif text-lg text-ink group-hover:text-spice transition-colors">{job.title}</p>
                          <p className="text-[13px] text-muted mt-0.5">{job.location} · {job.type}</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-spice flex-shrink-0">
                          Apply <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* No-fit band */}
        <Section tone="parchment">
          <div className="container-x">
            <div className="card p-8 sm:p-12 text-center max-w-3xl mx-auto">
              <FadeUp>
                <h2 className="font-serif text-2xl md:text-3xl text-ink mb-3">Nothing fits, but you’re exceptional?</h2>
                <p className="text-stone font-light leading-relaxed mb-7 max-w-xl mx-auto">
                  We’d still love to meet you. Tell us what you do best and where you’d make the biggest difference.
                </p>
                <a href={`mailto:${SITE.email.careers}?subject=General%20application`} className="btn-primary">
                  Write to us
                </a>
              </FadeUp>
            </div>
          </div>
        </Section>

        <CtaBand
          title="The best food economy needs the best people."
          intro="Help us build something a continent will use every day."
          tone="ink"
          ctas={[
            { label: 'See open roles', href: '#roles', primary: true },
            { label: SITE.email.careers, href: `mailto:${SITE.email.careers}` },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
