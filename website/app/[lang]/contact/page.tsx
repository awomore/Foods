import type { Metadata } from 'next';
import { Mail, MapPin, Phone, Flame, Bike, Newspaper, LifeBuoy } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import JsonLd from '@/components/site/JsonLd';
import ContactForm from '@/components/site/ContactForm';
import { Section } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { rich } from '@/lib/i18n/rich';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).contact;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/contact' });
}

const CHANNELS = [
  { icon: Flame, email: SITE.email.creators },
  { icon: Bike, email: SITE.email.partnerships },
  { icon: Newspaper, email: SITE.email.press },
  { icon: LifeBuoy, email: SITE.email.support },
];

export default function ContactPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.contact;
  return (
    <Shell lang={lang}>
      <JsonLd data={breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/contact' }])} />
      <PageHero kicker={t.kicker} title={rich(t.title)} intro={t.intro} />

      <Section tone="parchment">
        <div className="container-x grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-start">
          <div>
            <FadeUp>
              <h2 className="font-serif font-bold text-2xl md:text-3xl text-ink mb-2">{t.reachTitle}</h2>
              <p className="text-stone leading-relaxed mb-8 max-w-md">{t.reachBody}</p>
            </FadeUp>

            <FadeUp delay={0.06}>
              <div className="space-y-3 mb-8">
                <a href={`mailto:${SITE.email.hello}`} className="flex items-center gap-4 group">
                  <span className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0"><Mail size={19} /></span>
                  <span>
                    <span className="block text-[12px] text-muted">{t.general}</span>
                    <span className="block text-ink font-medium group-hover:text-spice transition-colors">{SITE.email.hello}</span>
                  </span>
                </a>
                <a href={SITE.phone.href} className="flex items-center gap-4 group">
                  <span className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0"><Phone size={19} /></span>
                  <span>
                    <span className="block text-[12px] text-muted">{t.phone}</span>
                    <span className="block text-ink font-medium group-hover:text-spice transition-colors" dir="ltr">{SITE.phone.display}</span>
                  </span>
                </a>
                <div className="flex items-center gap-4">
                  <span className="w-11 h-11 rounded-2xl bg-spice/10 text-spice flex items-center justify-center flex-shrink-0"><MapPin size={19} /></span>
                  <span>
                    <span className="block text-[12px] text-muted">{t.office}</span>
                    <span className="block text-ink font-medium" lang="en">{SITE.address.street}, {SITE.address.city}, {SITE.address.country}</span>
                  </span>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.12}>
              <div className="grid sm:grid-cols-2 gap-3">
                {t.channels.map((c, i) => {
                  const Icon = CHANNELS[i].icon;
                  return (
                    <a key={c.title} href={`mailto:${CHANNELS[i].email}`} className="group card p-5 hover:shadow-warm transition-all duration-500">
                      <div className="w-10 h-10 rounded-xl bg-warm text-spice flex items-center justify-center mb-3 group-hover:bg-spice group-hover:text-cream transition-colors">
                        <Icon size={18} />
                      </div>
                      <p className="text-[14px] font-semibold text-ink">{c.title}</p>
                      <p className="text-[12px] text-muted mt-0.5">{c.desc}</p>
                      <p className="text-[12px] text-spice font-medium mt-2">{CHANNELS[i].email}</p>
                    </a>
                  );
                })}
              </div>
            </FadeUp>
          </div>

          <FadeUp delay={0.1}>
            <ContactForm t={t.form} />
          </FadeUp>
        </div>
      </Section>
    </Shell>
  );
}
