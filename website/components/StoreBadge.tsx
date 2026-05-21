import clsx from 'clsx';

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current flex-shrink-0">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const GooglePlayIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="none">
    <path d="M3.61 1.814C3.2 2.04 3 2.54 3 3.22v17.56c0 .68.2 1.18.61 1.4l.08.05 9.84-9.84v-.23L3.69 1.77l-.08.04z" fill="#4285F4"/>
    <path d="M16.82 15.67l-3.29-3.29v-.23l3.29-3.3.07.04 3.89 2.21c1.11.63 1.11 1.66 0 2.29l-3.89 2.21-.07.07z" fill="#FBBC04"/>
    <path d="M16.89 15.6L13.53 12.22 3.61 22.14c.37.39.97.44 1.64.05l11.64-6.59z" fill="#EA4335"/>
    <path d="M16.89 8.4L5.25 1.81C4.58 1.42 3.98 1.47 3.61 1.86l9.92 9.92 3.36-3.38z" fill="#34A853"/>
  </svg>
);

export function StoreBadge({
  store,
  variant = 'dark',
  className,
}: {
  store: 'apple' | 'google';
  variant?: 'dark' | 'light' | 'outline';
  className?: string;
}) {
  const base = 'inline-flex items-center gap-3 rounded-xl px-5 py-3 transition-all duration-200 select-none';

  const variants = {
    dark: 'bg-ink text-white hover:bg-stone border border-ink',
    light: 'bg-white text-ink hover:bg-warm border border-warm',
    outline: 'bg-transparent text-white hover:bg-white/10 border border-white/30',
  };

  return (
    <a
      href="#"
      className={clsx(base, variants[variant], className)}
      aria-label={store === 'apple' ? 'Download on the App Store' : 'Get it on Google Play'}
    >
      {store === 'apple' ? <AppleIcon /> : <GooglePlayIcon />}
      <div className="text-left">
        <p className="text-[10px] opacity-60 leading-none mb-0.5 font-light">
          {store === 'apple' ? 'Download on the' : 'Get it on'}
        </p>
        <p className="text-sm font-semibold leading-none">
          {store === 'apple' ? 'App Store' : 'Google Play'}
        </p>
      </div>
    </a>
  );
}
