import type { Metadata } from 'next';
import { Mail, FileText, Image as ImageIcon, Palette } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).press;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/press' });
}

const KIT_ICONS = [FileText, ImageIcon, Palette, ImageIcon];

export default function PressPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.press;
  const [before, after] = t.mediaContact.split('{email}');
  return (
    <Shell lang={lang}>
      <JsonLd data={breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/press' }])} />
      <PageHero
        kicker={t.kicker}
        title={rich(t.title)}
        intro={t.intro}
        ctas={[
          { label: t.ctaKit, href: `mailto:${SITE.email.press}?subject=Media%20kit%20request`, variant: 'primary' },
          { label: t.ctaContact, href: `mailto:${SITE.email.press}`, variant: 'ghost-light' },
        ]}
      />

      {/* Media kit — requested by email until the assets are hosted. */}
      <Section tone="cream">
        <div className="container-x">
          <SectionHeading kicker={t.kitKicker} title={rich(t.kitTitle)} intro={t.kitIntro} />
          <div className="mt-12 grid sm:grid-cols-2 gap-5">
            {t.kit.map((k, i) => {
              const Icon = KIT_ICONS[i];
              return (
                <FadeUp key={k.title} delay={(i % 2) * 0.08}>
                  <a
                    href={`mailto:${SITE.email.press}?subject=${encodeURIComponent(`Media kit: ${k.title}`)}`}
                    className="group flex items-center gap-5 card p-6 hover:shadow-warm hover:-translate-y-0.5 transition-all duration-500"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0 group-hover:bg-spice group-hover:text-cream transition-colors">
                      <Icon size={22} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-serif text-lg text-ink">{k.title}</h3>
                      <p className="text-stone text-[14px] mt-0.5">{k.desc}</p>
                    </div>
                    <Mail size={18} className="text-muted group-hover:text-spice transition-colors flex-shrink-0" />
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
            <span className="kicker kicker-dot">{t.boilerKicker}</span>
            <h2 className="font-serif font-bold text-2xl md:text-3xl text-ink mt-5 mb-4">{t.boilerTitle}</h2>
            <p className="text-stone leading-relaxed text-[17px] text-pretty">{t.boilerplate}</p>
            <p className="mt-6 text-[14px] text-muted">
              {before}
              <a href={`mailto:${SITE.email.press}`} className="text-spice font-medium hover:underline">{SITE.email.press}</a>
              {after}
            </p>
          </FadeUp>
        </div>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        tone="ink"
        ctas={[
          { label: t.ctaContact, href: `mailto:${SITE.email.press}`, primary: true },
          { label: t.ctaStories, href: localePath(lang, '/blog') },
        ]}
      />
    </Shell>
  );
}
