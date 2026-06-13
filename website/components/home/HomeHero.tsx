'use client';

import { motion } from 'framer-motion';
import NetworkGraph from '@/components/ui/NetworkGraph';
import { AppBadges } from '@/components/site/AppBadges';

const ease = [0.16, 1, 0.3, 1] as const;
const words = ['Food.', 'Creators.', 'Community.', 'Commerce.'];

export default function HomeHero() {
  return (
    <section className="relative min-h-[100dvh] bg-ink overflow-hidden grain flex items-center">
      {/* Network visualisation */}
      <div className="absolute inset-0 opacity-90">
        <NetworkGraph className="w-full h-full" />
      </div>
      {/* Warm radial glow + vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(200,75,49,0.22),transparent_55%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/70" />

      <div className="container-x relative z-10 pt-32 pb-20 w-full">
        <div className="max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease }}
            className="inline-flex items-center gap-2.5 rounded-full border border-cream/15 bg-cream/5 backdrop-blur-sm px-4 py-2 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-spice opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-spice" />
            </span>
            <span className="text-cream/80 text-[12px] font-medium tracking-wide">
              4,200+ creators building in Lagos, Accra &amp; Nairobi
            </span>
          </motion.div>

          <h1 className="font-serif text-cream leading-[0.98] tracking-[-0.03em] text-[clamp(3rem,9vw,7rem)]">
            {words.map((w, i) => (
              <motion.span
                key={w}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease }}
                className={`block ${i === words.length - 1 ? 'text-gradient-spice italic font-normal' : ''}`}
              >
                {w}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8, ease }}
            className="mt-8 text-cream/70 text-lg md:text-xl leading-relaxed font-light max-w-xl text-pretty"
          >
            FOODS is where food creators build audiences, earn income, and grow
            communities. Discover kitchens you love, follow their stories, and
            taste what they make next.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.95, ease }}
            className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          >
            <AppBadges variant="dark" />
            <a href="/for-creators" className="btn-ghost-light">
              I’m a creator →
            </a>
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.4 }}
        className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2"
      >
        <span className="text-cream/30 text-[10px] uppercase tracking-[0.2em]">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-px h-7 bg-gradient-to-b from-cream/40 to-transparent"
        />
      </motion.div>
    </section>
  );
}
