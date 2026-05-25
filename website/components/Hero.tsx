'use client';

import { useEffect, useRef } from 'react';
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
    <section className="relative min-h-[100dvh] bg-parchment overflow-hidden flex flex-col md:flex-row">
      {/* Left — Text column */}
      <div className="relative z-10 flex flex-col justify-center px-6 md:px-10 lg:px-16 xl:px-20 pt-28 pb-16 md:py-0 md:w-[52%] lg:w-[50%] flex-shrink-0">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease }}
          className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-8 md:mb-10"
        >
          Now in Lagos
        </motion.p>

        {/* Headline */}
        <div className="overflow-hidden">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease }}
            className="font-serif text-[clamp(2.8rem,6vw,5.5rem)] leading-[1.05] tracking-[-0.025em] text-ink mb-6 md:mb-8"
          >
            Join someone&apos;s
            <br />
            <em className="font-normal not-italic italic">table.</em>
          </motion.h1>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease }}
          className="text-stone text-base md:text-lg leading-relaxed mb-10 md:mb-12 max-w-sm font-light"
        >
          A discovery platform for home cooks with real stories, real kitchens, and communities that care about food the way you do.
        </motion.p>

        {/* App store CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.65, ease }}
          className="flex flex-col sm:flex-row gap-3 mb-14 md:mb-16"
        >
          <AppStoreButton store="apple" />
          <AppStoreButton store="google" />
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.85 }}
          className="flex gap-8 md:gap-10 pt-8 border-t border-border/70"
        >
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="font-serif text-2xl md:text-3xl text-ink font-medium">{value}</p>
              <p className="text-[10px] text-muted mt-1 font-medium tracking-[0.15em] uppercase">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right — Image column */}
      <div className="relative md:flex-1 h-[45vh] md:h-auto order-first md:order-last">
        {/* Gradient overlay (left side, blends with text column on desktop) */}
        <div className="absolute inset-0 z-10">
          <div className="hidden md:block absolute inset-y-0 left-0 w-[20%] bg-gradient-to-r from-parchment to-transparent" />
          <div className="md:hidden absolute inset-0 bg-gradient-to-b from-transparent via-parchment/40 to-parchment" />
        </div>

        <Image
          src="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1400&q=85"
          alt="A beautifully prepared home-cooked meal"
          fill
          className="object-cover object-center"
          priority
          sizes="(max-width: 768px) 100vw, 55vw"
        />

        {/* Floating cook tag — decorative */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 1.0, ease }}
          className="absolute z-20 bottom-8 left-6 md:bottom-10 md:left-8 bg-cream/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-warm border border-border/40"
        >
          <p className="text-[10px] text-muted uppercase tracking-widest font-medium mb-0.5">Featured cook</p>
          <p className="text-sm text-ink font-semibold font-serif">Mama Titi&apos;s Kitchen</p>
          <p className="text-[11px] text-stone mt-0.5">Jollof · Egusi · Pepper Soup</p>
        </motion.div>

        {/* Rating badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.15, ease }}
          className="absolute z-20 top-8 right-6 md:top-10 md:right-8 bg-cream/95 backdrop-blur-sm rounded-2xl px-3 py-2.5 shadow-warm border border-border/40"
        >
          <p className="text-xs font-semibold text-ink">4.9 / 5</p>
          <p className="text-[10px] text-muted mt-0.5">238 reviews</p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2"
      >
        <p className="text-[10px] text-muted tracking-[0.2em] uppercase">Scroll</p>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-[1px] h-6 bg-gradient-to-b from-muted to-transparent"
        />
      </motion.div>
    </section>
  );
}

function AppStoreButton({ store }: { store: 'apple' | 'google' }) {
  const isApple = store === 'apple';

  return (
    <a
      href="#cta"
      className="group inline-flex items-center gap-3 px-5 py-3.5 bg-ink text-cream rounded-2xl hover:bg-charcoal transition-all duration-300 border border-transparent hover:border-border/20 shadow-warm-sm"
      aria-label={isApple ? 'Download on the App Store' : 'Get it on Google Play'}
    >
      {/* Icon */}
      <span className="text-cream/90 flex-shrink-0" aria-hidden>
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
        <p className="text-[9px] text-cream/60 uppercase tracking-wider font-medium leading-none mb-0.5">
          {isApple ? 'Download on the' : 'Get it on'}
        </p>
        <p className="text-sm font-semibold leading-none">{isApple ? 'App Store' : 'Google Play'}</p>
      </div>
    </a>
  );
}
