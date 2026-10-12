import type { Metadata } from 'next';
import Shell from '@/components/site/Shell';
import ShareLanding from '@/components/site/ShareLanding';
import { type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { pageMeta } from '@/lib/seo';

// The links the app shares (/cook/:id, /c/:handle, /creator/:slug, /post/:id, /join)
// are rewritten here by Netlify with a 200, so the browser keeps the shared URL and
// ShareLanding reads it to decide what to show.
type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).share;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/open', noindex: true });
}

export default function OpenPage({ params }: P) {
  return (
    <Shell lang={params.lang} mainClassName="min-h-[72vh] bg-cream flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-32 pb-20">
      <ShareLanding lang={params.lang} t={getDict(params.lang).share} badges={getDict(params.lang).common.appBadges} />
    </Shell>
  );
}
