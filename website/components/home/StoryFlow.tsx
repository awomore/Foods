'use client';

import { motion } from 'framer-motion';
import { Compass, Heart, Flame, ShoppingBag, Users, Sparkles } from 'lucide-react';
import { Kicker } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';

const steps = [
  { icon: Compass, title: 'Discover creators', body: 'Find cooks, bakers, and chefs near you — each with a real story and a signature.' },
  { icon: Heart, title: 'Follow their kitchen', body: 'Follow the ones you love. See what they’re making today and what’s dropping next.' },
  { icon: Flame, title: 'Crave a dish', body: 'A new menu, a fresh batch, a one-night-only special. Cravings turn into orders.' },
  { icon: ShoppingBag, title: 'Order the experience', body: 'Single meals, weekly menus, grazing boxes, or a full private dinner — booked in taps.' },
  { icon: Users, title: 'Join the community', body: 'Gift meals, rally around a creator, and belong to a table bigger than your own.' },
  { icon: Sparkles, title: 'Support local creators', body: 'Every order builds a real business for the person who made your food.' },
];

export default function StoryFlow() {
  return (
    <section className="relative bg-charcoal text-cream py-22 md:py-30 overflow-hidden bg-grid-dark">
      <div className="container-x relative">
        <div className="max-w-2xl">
          <FadeUp><Kicker>How it feels</Kicker></FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.08] tracking-[-0.02em] mt-5 text-cream text-balance">
              From a craving to a community, <span className="text-gradient-spice italic">in six moves.</span>
            </h2>
          </FadeUp>
        </div>

        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-cream/10 rounded-3xl overflow-hidden border border-cream/10">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="group relative bg-charcoal hover:bg-ink transition-colors duration-500 p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-2xl bg-spice/15 text-spice flex items-center justify-center group-hover:bg-spice group-hover:text-cream transition-colors duration-500">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <span className="font-serif text-cream/15 text-4xl group-hover:text-cream/25 transition-colors">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="font-serif text-xl text-cream mb-2">{s.title}</h3>
                <p className="text-cream/50 font-light leading-relaxed text-[15px]">{s.body}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
