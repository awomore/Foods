import type { Metadata } from 'next';
import LegalPage from '@/components/site/LegalPage';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { PRIVACY } from '@/lib/legal';
import { pageMeta } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).legal;
  return pageMeta(params.lang, { title: t.privacyTitle, description: t.privacyIntro, path: '/privacy' });
}

export default function PrivacyPage({ params }: P) {
  const t = getDict(params.lang).legal;
  return <LegalPage lang={params.lang} title={t.privacyTitle} intro={t.privacyIntro} doc={PRIVACY} />;
}
