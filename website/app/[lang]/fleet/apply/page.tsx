import type { Metadata } from 'next';
import { Clock, ShieldCheck, Headphones } from 'lucide-react';
import Shell from '@/components/site/Shell';
import JsonLd from '@/components/site/JsonLd';
import ApplyForm from '@/components/fleet/ApplyForm';
import { FadeUp } from '@/components/ui/FadeUp';
import { Kicker } from '@/components/ui/Section';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).apply;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/fleet/apply' });
}

const ICONS = [Clock, ShieldCheck, Headphones];

export default function ApplyPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.apply;
  const typeNames = d.fleet.types.map((x) => ({ id: x.id, name: x.name }));
  return (
    <Shell lang={lang} mainClassName="bg-parchment min-h-screen">
      <JsonLd
        data={breadcrumbSchema(lang, [
          { name: d.common.ui.home, path: '/' },
          { name: d.fleet.kicker, path: '/fleet' },
          { name: t.kicker, path: '/fleet/apply' },
        ])}
      />
      <section className="container-x pt-32 pb-16 md:pt-40">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-28">
            <FadeUp>
              <Kicker>{t.kicker}</Kicker>
              <h1 className="font-serif font-bold text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink mt-5 text-balance">{t.title}</h1>
              <p className="text-stone text-lg mt-5 leading-relaxed max-w-md">{t.intro}</p>
            </FadeUp>
            <FadeUp delay={0.1}>
              <ul className="mt-10 space-y-5">
                {t.assurances.map((a, i) => {
                  const Icon = ICONS[i];
                  return (
                    <li key={a.title} className="flex gap-4">
                      <span className="w-11 h-11 rounded-2xl bg-cream border border-border flex items-center justify-center text-spice flex-shrink-0">
                        <Icon size={20} />
                      </span>
                      <span>
                        <span className="block text-[15px] font-semibold text-ink">{a.title}</span>
                        <span className="block text-[13px] text-stone mt-0.5">{a.body}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </FadeUp>
          </div>
          <div>
            <ApplyForm lang={lang} t={t.form} types={typeNames} back={d.common.ui.back} next={d.common.ui.continue} />
          </div>
        </div>
      </section>
    </Shell>
  );
}
