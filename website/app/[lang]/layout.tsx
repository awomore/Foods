import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { LOCALES, LOCALE_INFO, scriptFont, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { organizationSchema, websiteSchema } from '@/lib/seo';
import { SITE } from '@/lib/site';
import { VisitorProvider } from '@/lib/visitor';
import JsonLd from '@/components/site/JsonLd';

// Every page lives under a language prefix (/en, /de, /ja…). Netlify redirects the bare
// domain to the visitor's browser language and old unprefixed URLs to /en.
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export function generateMetadata({ params }: { params: { lang: Locale } }): Metadata {
  const t = getDict(params.lang);
  return {
    metadataBase: new URL(SITE.url),
    title: { default: t.meta.defaultTitle, template: `%s · ${SITE.name}` },
    description: t.meta.description,
    applicationName: SITE.name,
    authors: [{ name: SITE.name }],
    creator: SITE.name,
    publisher: SITE.legalName,
    icons: {
      icon: [{ url: '/favicon.png', type: 'image/png' }],
      apple: [{ url: '/apple-icon.png', type: 'image/png' }],
      shortcut: '/favicon.png',
    },
    twitter: { creator: '@foodsbyme_x' },
    robots: { index: true, follow: true },
    category: 'food',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

const BASE_FONTS = ['Bricolage+Grotesque:opsz,wght@12..96,300..800', 'Geist:wght@300..700', 'Geist+Mono:wght@400;500'];

export default function RootLayout({ children, params }: { children: React.ReactNode; params: { lang: Locale } }) {
  const lang = params.lang;
  const t = getDict(lang);
  const script = scriptFont(lang);
  const families = script ? [...BASE_FONTS, `${script.replace(/ /g, '+')}:wght@400;500;700;800`] : BASE_FONTS;
  const fontsHref = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join('&')}&display=swap`;

  return (
    <html lang={lang} dir={LOCALE_INFO[lang].dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontsHref} />
        <JsonLd data={[organizationSchema(t.meta.description), websiteSchema(lang, t.meta.description)]} />
      </head>
      <body style={script ? ({ '--font-script': `'${script}'` } as React.CSSProperties) : undefined}>
        <VisitorProvider>{children}</VisitorProvider>
      </body>
    </html>
  );
}
