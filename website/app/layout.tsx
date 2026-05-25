import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FOODSbyme — Discover home cooks with real stories',
  description: 'A premium discovery platform connecting you with talented home cooks. Real kitchens, real food, real people. Order meals made with intention.',
  keywords: ['home cooked food', 'local cooks', 'food delivery Lagos', 'home kitchen', 'authentic meals', 'Nigerian food'],
  authors: [{ name: 'FOODSbyme' }],
  creator: 'FOODSbyme',
  openGraph: {
    title: 'FOODSbyme — Discover home cooks with real stories',
    description: 'A premium discovery platform connecting you with talented home cooks. Real kitchens, real food, real people.',
    type: 'website',
    locale: 'en_NG',
    siteName: 'FOODSbyme',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FOODSbyme',
    description: 'Discover home cooks with real stories. Join someone\'s table.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
