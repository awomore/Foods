import type { Metadata } from 'next';
import { SITE } from './site';
import { LOCALES, LOCALE_INFO, DEFAULT_LOCALE, localePath, type Locale } from './i18n/config';

type PageMetaInput = {
  title: string;
  description: string;
  path: string; // language-neutral, e.g. "/fleet"
  ogImage?: string;
  noindex?: boolean;
  /** Set when the page is translated chrome around English-only content. */
  absoluteTitle?: boolean;
};

const DEFAULT_OG = '/og-image.png';

/** Absolute URL of a page in a language. */
export const pageUrl = (lang: Locale, path: string) => `${SITE.url}${localePath(lang, path)}`;

/** hreflang alternates for every language, plus x-default pointing at English. */
export function languageAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of LOCALES) out[l] = pageUrl(l, path);
  out['x-default'] = pageUrl(DEFAULT_LOCALE, path);
  return out;
}

/** Consistent, SEO-complete metadata for any page, in any language. */
export function pageMeta(lang: Locale, { title, description, path, ogImage, noindex, absoluteTitle }: PageMetaInput): Metadata {
  const url = pageUrl(lang, path);
  // The layout's title.template appends the site name, so pages pass the bare title.
  // Open Graph and Twitter titles are not templated and spell it out.
  const socialTitle = path === '/' ? title : `${title} · ${SITE.name}`;
  const image = ogImage ?? DEFAULT_OG;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      title: socialTitle,
      description,
      url,
      type: 'website',
      locale: LOCALE_INFO[lang].og,
      alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => LOCALE_INFO[l].og),
      siteName: SITE.name,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [image],
    },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

// --- Structured data builders (JSON-LD) --------------------------------------

export function organizationSchema(description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    logo: `${SITE.url}/apple-icon.png`,
    description,
    email: SITE.email.hello,
    sameAs: Object.values(SITE.social),
  };
}

export function websiteSchema(lang: Locale, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: pageUrl(lang, '/'),
    inLanguage: lang,
    description,
  };
}

export function breadcrumbSchema(lang: Locale, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: pageUrl(lang, it.path),
    })),
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function articleSchema(a: {
  title: string;
  description: string;
  slug: string;
  date: string;
  author: string;
  image: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    image: a.image,
    datePublished: a.date,
    inLanguage: 'en',
    author: { '@type': 'Organization', name: a.author },
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    mainEntityOfPage: pageUrl('en', `/blog/${a.slug}`),
  };
}
