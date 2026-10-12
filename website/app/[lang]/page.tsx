import type { Metadata } from 'next';
import type { Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { pageMeta } from '@/lib/seo';
import Shell from '@/components/site/Shell';
import Hero from '@/components/home/Hero';
import LanguageBand from '@/components/home/LanguageBand';
import Doors from '@/components/home/Doors';
import Storefront from '@/components/home/Storefront';
import Platform from '@/components/home/Platform';
import CountrySpotlight from '@/components/home/CountrySpotlight';
import Partners from '@/components/home/Partners';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang);
  return pageMeta(params.lang, { title: t.home.metaTitle, description: t.home.metaDescription, path: '/', absoluteTitle: true });
}

export default function Home({ params }: P) {
  const lang = params.lang;
  const t = getDict(lang);
  return (
    <Shell lang={lang}>
      <Hero lang={lang} t={t.home} common={t.common} />
      <LanguageBand lang={lang} caption={t.home.band.caption} />
      <Doors lang={lang} t={t.home.doors} />
      <Storefront lang={lang} t={t.home.store} />
      <Platform t={t.home.platform} />
      <CountrySpotlight lang={lang} t={t.home.spot} badges={t.common.appBadges} countryLabel={t.common.region.country} />
      <Partners lang={lang} t={t.home.partners} />
    </Shell>
  );
}
