import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE } from '@/lib/site';
import { organizationSchema, websiteSchema } from '@/lib/seo';
import JsonLd from '@/components/site/JsonLd';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'FOODSbyme — The home of Africa’s creator food economy',
    template: '%s · FOODSbyme',
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'creator economy',
    'food creators',
    'home cooks Africa',
    'private chef Lagos',
    'food delivery partners',
    'fleet partnership Nigeria',
    'creator commerce',
    'weekly menus',
    'cooking courses',
    'FOODSbyme',
  ],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.legalName,
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    siteName: SITE.name,
    url: SITE.url,
    title: 'FOODSbyme — The home of Africa’s creator food economy',
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FOODSbyme',
    description: SITE.tagline,
    creator: '@foodsbyme',
  },
  robots: { index: true, follow: true },
  category: 'food',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#111827' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
      </head>
      <body>{children}</body>
    </html>
  );
}
