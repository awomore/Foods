import type { Metadata } from 'next';
import LegalPage from '@/components/site/LegalPage';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { REFUNDS } from '@/lib/legal';
import { pageMeta } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).legal;
  return pageMeta(params.lang, { title: t.refundsTitle, description: t.refundsIntro, path: '/refund-policy' });
}

export default function RefundPolicyPage({ params }: P) {
  const t = getDict(params.lang).legal;
  return <LegalPage lang={params.lang} title={t.refundsTitle} intro={t.refundsIntro} doc={REFUNDS} />;
}
