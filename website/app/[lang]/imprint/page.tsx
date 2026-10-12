import type { Metadata } from 'next';
import LegalPage from '@/components/site/LegalPage';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { IMPRINT } from '@/lib/legal';
import { pageMeta } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).legal;
  return pageMeta(params.lang, { title: t.imprintTitle, description: t.imprintIntro, path: '/imprint' });
}

export default function ImprintPage({ params }: P) {
  const t = getDict(params.lang).legal;
  return <LegalPage lang={params.lang} title={t.imprintTitle} intro={t.imprintIntro} doc={IMPRINT} />;
}
