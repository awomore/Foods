import type { Metadata } from 'next';
import Link from 'next/link';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';

export const metadata: Metadata = {
  title: 'Page not found · FOODSbyme',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main className="min-h-[72vh] bg-cream flex flex-col items-center justify-center text-center px-6 py-20">
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-spice mb-5">404</p>
        <h1 className="font-serif text-[clamp(2.8rem,6vw,5rem)] leading-[1.06] text-ink tracking-[-0.02em] text-balance">
          This page doesn't exist.
        </h1>
        <p className="mt-5 text-stone font-light text-lg max-w-md leading-relaxed">
          The page you're looking for may have moved or the link might be wrong. Let's get you somewhere useful.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary">Back to home</Link>
          <Link href="/support" className="btn-ghost">Help centre →</Link>
        </div>

        <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-xl w-full text-left">
          {[
            { label: 'For creators', href: '/for-creators', desc: 'Open your kitchen on FOODS.' },
            { label: 'Fleet partners', href: '/fleet', desc: 'Power the delivery network.' },
            { label: 'Stories', href: '/blog', desc: 'Creator journeys and culture.' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="card p-5 hover:shadow-warm transition-all duration-300 group"
            >
              <p className="text-[13px] font-semibold text-ink group-hover:text-spice transition-colors">
                {l.label} →
              </p>
              <p className="text-[12px] text-muted font-light mt-0.5">{l.desc}</p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
