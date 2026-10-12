'use client';

import { fmt } from '@/lib/i18n/rich';
import { regionName, useVisitor } from '@/lib/visitor';

/** "Live in Berlin" — the only place on the homepage that names a location: the visitor's own. */
export default function HeroStatus({ lang, live, available }: { lang: string; live: string; available: string }) {
  const { country, city, ready } = useVisitor();
  // Netlify reports city names in English, so only English pages name the city;
  // everyone else sees their country in their own language.
  const place = (lang === 'en' && city) || (country ? regionName(country, lang) : null);
  const text = ready && place ? fmt(live, { place }) : available;

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border px-3.5 py-1.5 text-[13.5px] text-stone">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#15803D] opacity-50 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#15803D]" />
      </span>
      <span aria-live="polite">{text}</span>
    </div>
  );
}
