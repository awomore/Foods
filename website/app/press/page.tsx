import type { Metadata } from 'next';
import { ArrowUpRight, Download, FileText, Image as ImageIcon, Palette } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { Counter } from '@/components/ui/Counter';
import { PRESS_ITEMS } from '@/lib/data';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Press — news, media kit, and brand assets',
  description:
    'FOODSbyme in the press. Download our media kit, brand assets, and fact sheet, and get in touch with our communications team.',
  path: '/press',
  keywords: ['FOODSbyme press', 'media kit', 'brand assets', 'food startup news Africa', 'press inquiries'],
});

const facts = [
  { value: 2024, label: 'Founded', plain: true },
  { value: 4200, suffix: '+', label: 'Food creators' },
  { value: 380, suffix: 'k+', label: 'Community members' },
  { value: 12, label: 'Cities' },
];

const kit = [
  { icon: FileText, title: 'Company fact sheet', desc: 'Mission, milestones, leadership, and the numbers — in one page.' },
  { icon: ImageIcon, title: 'Logo & wordmark pack', desc: 'SVG and PNG logos, in light and dark, with clear-space guidance.' },
  { icon: Palette, title: 'Brand guidelines', desc: 'Colour, type, voice, and how to talk about the creator food economy.' },
  { icon: ImageIcon, title: 'Product & creator imagery', desc: 'High-resolution screenshots and approved creator photography.' },
];

export default function PressPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Press', path: '/press' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Press"
          title={<>The story of a new <span className="text-gradient-spice italic">food economy.</span></>}
          intro="Resources for journalists and storytellers covering FOODSbyme and the rise of Africa’s creator-commerce food economy."
          ctas={[
            { label: 'Download media kit', href: `mailto:${SITE.email.press}?subject=Media%20kit%20request`, variant: 'primary' },
            { label: 'Contact press team', href: `mailto:${SITE.email.press}`, variant: 'ghost-light' },
          ]}
        />

        {/* Fast facts */}
        <section className="bg-charcoal text-cream py-16 grain relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(200,75,49,0.16),transparent_55%)]" />
          <div className="container-x relative grid grid-cols-2 lg:grid-cols-4 gap-10">
            {facts.map((f) => (
              <div key={f.label} className="text-center">
                <p className="font-serif text-[clamp(2rem,4vw,3rem)] text-cream leading-none">
                  {f.plain ? f.value : <Counter to={f.value} suffix={f.suffix} />}
                </p>
                <p className="mt-3 text-[12px] text-cream/50 font-medium tracking-wide">{f.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* In the news */}
        <Section tone="parchment">
          <div className="container-x">
            <SectionHeading
              kicker="In the news"
              title={<>FOODS in the <span className="text-gradient-spice italic">headlines</span></>}
              intro="Selected coverage of our platform, our creators, and the partner-owned network powering delivery."
            />
            <div className="mt-12 rounded-3xl border border-border overflow-hidden divide-y divide-border bg-cream">
              {PRESS_ITEMS.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-5 hover:bg-warm/50 transition-colors"
                >
                  <div className="sm:flex sm:items-center sm:gap-5">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-spice sm:w-32">{item.outlet}</span>
                    <span className="block font-serif text-lg text-ink group-hover:text-spice transition-colors mt-1 sm:mt-0">{item.title}</span>
                  </div>
                  <span className="inline-flex items-center gap-2 text-[13px] text-muted flex-shrink-0">
                    {item.date}
                    <ArrowUpRight size={15} className="text-spice group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </Section>

        {/* Media kit */}
        <Section tone="cream">
          <div className="container-x">
            <SectionHeading
              kicker="Media kit"
              title={<>Everything you need to tell the <span className="text-gradient-spice italic">story right</span></>}
              intro="Brand assets and background, ready to use. For anything else — interviews, data, creator introductions — reach our press team."
            />
            <div className="mt-12 grid sm:grid-cols-2 gap-5">
              {kit.map((k, i) => {
                const Icon = k.icon;
                return (
                  <FadeUp key={k.title} delay={(i % 2) * 0.08}>
                    <a
                      href={`mailto:${SITE.email.press}?subject=${encodeURIComponent(`Media kit — ${k.title}`)}`}
                      className="group flex items-center gap-5 card p-6 hover:shadow-warm hover:-translate-y-0.5 transition-all duration-500"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0 group-hover:bg-spice group-hover:text-cream transition-colors">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-serif text-lg text-ink">{k.title}</h3>
                        <p className="text-stone font-light text-[14px] mt-0.5">{k.desc}</p>
                      </div>
                      <Download size={18} className="text-muted group-hover:text-spice transition-colors flex-shrink-0" />
                    </a>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </Section>

        {/* Boilerplate */}
        <Section tone="parchment">
          <div className="container-narrow">
            <FadeUp>
              <span className="kicker kicker-dot">About FOODSbyme</span>
              <h2 className="font-serif text-2xl md:text-3xl text-ink mt-5 mb-4">Company boilerplate</h2>
              <p className="text-stone font-light leading-relaxed text-[17px] text-pretty">
                FOODSbyme is the home of Africa’s creator-commerce food economy. The platform lets food creators — home cooks, bakers, pastry chefs, and food entrepreneurs — build audiences, publish weekly menus, sell courses and products, host private dining, and earn real income from a single profile. Customers follow the kitchens they love and order experiences, not just meals, while a network of partner-owned fleets powers delivery. Founded in 2024 and headquartered in Lagos, Nigeria, FOODSbyme is building the digital headquarters of a new food economy across Africa.
              </p>
              <p className="mt-6 text-[14px] text-muted">
                For media enquiries, contact{' '}
                <a href={`mailto:${SITE.email.press}`} className="text-spice font-medium hover:underline">{SITE.email.press}</a>.
              </p>
            </FadeUp>
          </div>
        </Section>

        <CtaBand
          title="Writing about the creator food economy?"
          intro="Our communications team is happy to help with data, interviews, and creator introductions."
          tone="ink"
          ctas={[
            { label: 'Contact press team', href: `mailto:${SITE.email.press}`, primary: true },
            { label: 'Read our stories', href: '/blog' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
