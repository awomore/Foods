import Image from 'next/image';
import { FadeUp } from './ui/FadeUp';

export default function CTA() {
  return (
    <section id="cta" className="py-24 md:py-36 bg-parchment overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Full-width editorial panel */}
        <FadeUp>
          <div className="relative rounded-3xl md:rounded-[2rem] overflow-hidden bg-ink min-h-[420px] md:min-h-[480px] flex flex-col justify-center">
            {/* Background image with heavy overlay */}
            <div className="absolute inset-0">
              <Image
                src="https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1600&q=80"
                alt=""
                fill
                className="object-cover opacity-20"
                aria-hidden
                sizes="100vw"
              />
            </div>

            {/* Grain texture overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-ink/90 via-ink/80 to-charcoal/95" />

            {/* Content */}
            <div className="relative z-10 px-8 md:px-14 lg:px-20 py-14 md:py-20 max-w-3xl">
              <FadeUp delay={0.1}>
                <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-6">
                  Start now
                </p>
              </FadeUp>

              <FadeUp delay={0.2}>
                <h2 className="font-serif text-[clamp(2.2rem,5vw,4.2rem)] text-cream leading-[1.05] tracking-tight mb-6">
                  Your next favourite<br />
                  cook is already here.
                </h2>
              </FadeUp>

              <FadeUp delay={0.3}>
                <p className="text-warm/60 text-base leading-relaxed mb-10 max-w-sm font-light">
                  Download the app and discover home cooks with real stories, real food, and a table always set for you.
                </p>
              </FadeUp>

              <FadeUp delay={0.4}>
                <div className="flex flex-col sm:flex-row gap-3">
                  <CTAAppButton store="apple" />
                  <CTAAppButton store="google" />
                </div>
              </FadeUp>

              <FadeUp delay={0.5}>
                <p className="text-warm/30 text-xs mt-8 font-light tracking-wide">
                  Available on iOS and Android &middot; Free to download
                </p>
              </FadeUp>
            </div>

            {/* Decorative corner detail */}
            <div
              className="absolute right-0 top-0 bottom-0 w-[40%] hidden lg:block pointer-events-none"
              aria-hidden
            >
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-ink/80" />
              <Image
                src="https://images.unsplash.com/photo-1476224203421-9ac39bcb3df1?auto=format&fit=crop&w=800&q=70"
                alt=""
                fill
                className="object-cover opacity-30 mix-blend-luminosity"
                sizes="40vw"
              />
            </div>
          </div>
        </FadeUp>

        {/* Cook CTA below */}
        <FadeUp delay={0.2} className="mt-12 text-center">
          <p className="text-stone text-sm font-light">
            Are you a home cook?{' '}
            <a
              href="mailto:hello@foodsbyme.com"
              className="text-ink font-medium underline underline-offset-4 decoration-border hover:text-spice hover:decoration-spice transition-colors"
            >
              Apply to join as a cook
            </a>
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

function CTAAppButton({ store }: { store: 'apple' | 'google' }) {
  const isApple = store === 'apple';

  return (
    <a
      href={isApple ? '#' : '#'}
      className="group inline-flex items-center gap-3 px-5 py-3.5 bg-cream/10 hover:bg-cream/20 text-cream border border-cream/20 hover:border-cream/30 rounded-2xl transition-all duration-300 backdrop-blur-sm"
      aria-label={isApple ? 'Download on the App Store' : 'Get it on Google Play'}
    >
      <span className="text-cream/80 flex-shrink-0" aria-hidden>
        {isApple ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.18 23.76c.35.2.74.24 1.1.1L13.84 12 4.28.14c-.36-.14-.75-.1-1.1.1C2.47.65 2 1.34 2 2.12v19.76c0 .78.47 1.47 1.18 1.88zM16.39 9.39l2.51-2.51c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L17.8 10.8l2.51 2.51c.39.39.39 1.02 0 1.41-.39.39-1.02.39-1.41 0l-2.51-2.51-6.77 6.77-2.12-2.12 9.47-9.47zm-2.55 6.22L5.3 24h8.63l6.45-6.45-5.54-1.94z"/>
          </svg>
        )}
      </span>
      <div>
        <p className="text-[9px] text-cream/50 uppercase tracking-wider font-medium leading-none mb-0.5">
          {isApple ? 'Download on the' : 'Get it on'}
        </p>
        <p className="text-sm font-semibold leading-none">{isApple ? 'App Store' : 'Google Play'}</p>
      </div>
    </a>
  );
}
