import type { Metadata } from 'next';
import LegalPage from '@/components/site/LegalPage';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { TERMS } from '@/lib/legal';
import { pageMeta } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).legal;
  return pageMeta(params.lang, { title: t.termsTitle, description: t.termsIntro, path: '/terms' });
}

export default function TermsPage({ params }: P) {
  const t = getDict(params.lang).legal;
  return <LegalPage lang={params.lang} title={t.termsTitle} intro={t.termsIntro} doc={TERMS} />;
}
