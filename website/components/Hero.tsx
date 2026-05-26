'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

const stats = [
  { value: '500+', label: 'Home cooks' },
  { value: '12k+', label: 'Meals delivered' },
  { value: '4.9', label: 'Average rating' },
];

export default function Hero() {
  return (
    <section className="relative min-h-[92dvh] bg-ink overflow-hidden flex flex-col md:flex-row">
      {/* Full bleed background image */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1600&q=90"
          alt="Nigerian chef cooking in a real home kitchen"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        {/* Dark overlay — stronger on left for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink/92 via-ink/70 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center px-6 md:px-10 lg:px-16 xl:px-20 pt-28 pb-14 md:py-0 max-w-3xl">
        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease }}
          className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-7">
          Now in Lagos
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease }}
          className="font-serif text-[clamp(2.8rem,6vw,5.5rem)] leading-[1.05] tracking-[-0.025em] text-cream mb-5">
          Join someone&apos;s
          <br />
          <em className="font-normal italic">table.</em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease }}
          className="text-cream/70 text-base md:text-lg leading-relaxed mb-9 max-w-sm font-light">
          Discover talented home cooks and private chefs across Lagos. Order real meals, book private sessions, and follow the kitchens you love.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65, ease }}
          className="flex flex-col sm:flex-row gap-3 mb-12">
          <AppStoreButton store="apple" />
          <AppStoreButton store="google" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.85 }}
          className="flex gap-8 md:gap-10 pt-7 border-t border-cream/15">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="font-serif text-2xl md:text-3xl text-cream font-medium">{value}</p>
              <p className="text-[10px] text-cream/40 mt-1 font-medium tracking-[0.15em] uppercase">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Floating cook tag */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, delay: 1.0, ease }}
        className="absolute z-20 bottom-8 right-6 md:bottom-10 md:right-10 bg-cream/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-cream/20">
        <p className="text-[10px] text-cream/50 uppercase tracking-widest font-medium mb-0.5">Live now</p>
        <p className="text-sm text-cream font-semibold font-serif">Mama Titi&apos;s Kitchen</p>
        <p className="text-[11px] text-cream/60 mt-0.5">Jollof · Egusi · Pepper Soup</p>
      </motion.div>

      {/* Social proof badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 1.15, ease }}
        className="absolute z-20 top-24 md:top-10 right-6 md:right-10 bg-cream/10 backdrop-blur-md rounded-2xl px-3 py-2.5 border border-cream/20">
        <p className="text-xs font-semibold text-cream">2,400 following</p>
        <p className="text-[10px] text-cream/50 mt-0.5">on FOODSbyme</p>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2">
        <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-[1px] h-6 bg-gradient-to-b from-cream/40 to-transparent" />
      </motion.div>
    </section>
  );
}

function AppStoreButton({ store }: { store: 'apple' | 'google' }) {
  const isApple = store === 'apple';
  return (
    <a href="#cta"
      className="group inline-flex items-center gap-3 px-5 py-3.5 bg-cream/10 text-cream border border-cream/25 rounded-2xl hover:bg-cream/20 hover:border-cream/40 transition-all duration-300 backdrop-blur-sm"
      aria-label={isApple ? 'Download on the App Store' : 'Get it on Google Play'}>
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
