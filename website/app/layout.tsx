import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FOODSbyme — Home-cooked meals from your neighbourhood',
  description: 'Order authentic home-cooked meals from real local cooks near you. Fresh, personal, and made with love.',
  openGraph: {
    title: 'FOODSbyme',
    description: 'Home-cooked meals from your neighbourhood',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
