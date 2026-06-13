import { SITE } from '@/lib/site';

const AppleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M3.18 23.76c.35.2.74.24 1.1.1L13.84 12 4.28.14c-.36-.14-.75-.1-1.1.1C2.47.65 2 1.34 2 2.12v19.76c0 .78.47 1.47 1.18 1.88zM16.39 9.39l2.51-2.51c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L17.8 10.8l2.51 2.51c.39.39.39 1.02 0 1.41-.39.39-1.02.39-1.41 0l-2.51-2.51-6.77 6.77-2.12-2.12 9.47-9.47zm-2.55 6.22L5.3 24h8.63l6.45-6.45-5.54-1.94z" />
  </svg>
);

export function AppBadges({
  variant = 'light',
  className = '',
}: {
  variant?: 'light' | 'dark';
  className?: string;
}) {
  const base =
    variant === 'dark'
      ? 'bg-cream/10 text-cream border-cream/25 hover:bg-cream/20 hover:border-cream/40'
      : 'bg-ink text-cream border-ink hover:bg-charcoal';
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      {[
        { store: 'apple', href: SITE.app.ios, icon: AppleIcon, top: 'Download on the', bottom: 'App Store' },
        { store: 'google', href: SITE.app.android, icon: GoogleIcon, top: 'Get it on', bottom: 'Google Play' },
      ].map((b) => (
        <a
          key={b.store}
          href={b.href}
          className={`group inline-flex items-center gap-3 px-5 py-3.5 rounded-2xl border transition-all duration-300 backdrop-blur-sm ${base}`}
          aria-label={`${b.top} ${b.bottom}`}
        >
          <span className="flex-shrink-0 opacity-80">{b.icon}</span>
          <span className="text-left">
            <span className="block text-[9px] uppercase tracking-wider opacity-60 leading-none mb-0.5">
              {b.top}
            </span>
            <span className="block text-sm font-semibold leading-none">{b.bottom}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
