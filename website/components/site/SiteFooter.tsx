import Link from 'next/link';
import { SITE, footerNav, legalNav } from '@/lib/site';
import { localePath, type Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n/dict';
import { AppBadges } from './AppBadges';
import RegionPicker from './RegionPicker';
import Wordmark from './Wordmark';

const socials = [
  {
    label: 'Instagram',
    href: SITE.social.instagram,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    label: 'X',
    href: SITE.social.twitter,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: SITE.social.tiktok,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.83a8.23 8.23 0 0 0 4.81 1.53V6.89a4.85 4.85 0 0 1-1.04-.2z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: SITE.social.linkedin,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 18.34V9.99H5.67v8.35zM7 8.82a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.34 9.52v-4.58c0-2.45-1.31-3.59-3.06-3.59a2.64 2.64 0 0 0-2.39 1.31v-1.13h-2.67v8.35h2.67v-4.4c0-1.16.22-2.28 1.66-2.28s1.42 1.32 1.42 2.35v4.33z" />
      </svg>
    ),
  },
];

export default function SiteFooter({ lang, t, tagline }: { lang: Locale; t: Dict['common']; tagline: string }) {
  const year = new Date().getFullYear();
  const href = (p: string) => localePath(lang, p);
  return (
    <footer className="bg-ink text-cream">
      {/* Pre-footer CTA band */}
      <div className="border-b border-cream/10">
        <div className="container-x py-14 md:py-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h2 className="font-serif font-bold text-[clamp(1.7rem,3vw,2.4rem)] leading-tight tracking-[-0.025em] text-cream max-w-md text-balance">
              {t.footer.ctaTitle}
            </h2>
            <p className="text-cream/55 mt-3 max-w-md">{t.footer.ctaBody}</p>
          </div>
          <AppBadges variant="dark" t={t.appBadges} className="md:flex-shrink-0" />
        </div>
      </div>

      <div className="container-x pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-10 mb-16">
          <div className="md:col-span-2">
            <Link href={href('/')} className="inline-block mb-4" aria-label={SITE.name}>
              <Wordmark tone="dark" />
            </Link>
            <p className="text-cream/50 text-sm leading-relaxed mb-6 max-w-[16rem]">{tagline}</p>
            <div className="flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-8 h-8 rounded-full border border-cream/15 flex items-center justify-center text-cream/50 hover:text-cream hover:border-cream/40 transition-all duration-200"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {footerNav(t).map((group) => (
              <div key={group.label}>
                <p className="text-cream/45 font-mono text-[10.5px] uppercase tracking-[0.12em] mb-4">{group.label}</p>
                <ul className="space-y-3">
                  {group.links!.map((link) => (
                    <li key={link.href}>
                      <Link href={href(link.href)} className="text-cream/70 text-[13.5px] hover:text-spice transition-colors duration-200">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-cream/10 pt-8 flex flex-col lg:flex-row lg:items-center gap-5">
          <RegionPicker lang={lang} labels={t.region} tone="dark" align="start" placement="above" />
          <p className="text-cream/45 text-xs">
            &copy; {year} {SITE.legalName}. {t.footer.rights}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:ms-auto">
            {legalNav(t.legalNav).map((l) => (
              <Link key={l.href} href={href(l.href)} className="text-cream/60 text-xs hover:text-cream transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
