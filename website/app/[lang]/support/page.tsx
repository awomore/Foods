import type { Metadata } from 'next';
import Shell from '@/components/site/Shell';
import JsonLd from '@/components/site/JsonLd';
import SupportContent from '@/components/SupportContent';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { pageMeta, faqSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).support;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/support' });
}

export default function SupportPage({ params }: P) {
  const t = getDict(params.lang).support;
  return (
    <Shell lang={params.lang}>
      <JsonLd data={faqSchema(t.topics.flatMap((x) => x.items))} />
      <SupportContent t={t} />
    </Shell>
  );
}
