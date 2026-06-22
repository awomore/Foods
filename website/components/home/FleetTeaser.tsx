'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Kicker } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { Counter } from '@/components/ui/Counter';

const points = [
  'Order flow routed to you automatically',
  'Live tracking, settlement, and analytics built in',
  'Brand, training, and operational support',
  'Grow from one bike to a whole territory',
];

export default function FleetTeaser() {
  return (
    <section className="relative bg-ink text-cream overflow-hidden grain">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(196,154,60,0.18),transparent_55%)]" />
      <div className="container-x relative py-22 md:py-30 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <FadeUp><Kicker>The fleet ecosystem</Kicker></FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="font-serif text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.08] tracking-[-0.02em] mt-5 text-cream text-balance">
              The delivery network powering Africa’s food creator economy — <span className="text-gradient-spice italic">owned by partners.</span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-5 text-cream/60 text-lg font-light leading-relaxed max-w-lg">
              Every order a creator fulfils needs to move. We don’t own the bikes — partners do. Bicycle and motorbike riders, bike fleets, cooperatives, and community transport groups build real businesses on FOODS infrastructure.
            </p>
          </FadeUp>
          <FadeUp delay={0.18}>
            <ul className="mt-8 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-cream/80">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-spice flex-shrink-0" />
                  <span className="font-light">{p}</span>
                </li>
              ))}
            </ul>
          </FadeUp>
          <FadeUp delay={0.24}>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link href="/fleet" className="btn-primary">Explore fleet partnership</Link>
              <Link href="/fleet/apply" className="btn-ghost-light">Apply in 5 steps →</Link>
            </div>
          </FadeUp>
        </div>

        <FadeUp delay={0.1} className="relative">
          <div className="relative rounded-4xl overflow-hidden aspect-[4/5] shadow-warm-xl">
            <Image
              src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80"
              alt="A fleet of FOODS bicycle and motorbike delivery partners"
              fill
              sizes="(max-width:1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="absolute -bottom-5 -left-3 sm:left-6 card bg-cream/95 backdrop-blur p-5 w-56"
          >
            <p className="font-serif text-3xl text-ink">
              <Counter prefix="₦" to={340} suffix="k" />
            </p>
            <p className="text-[12px] text-stone mt-1 leading-snug">Avg. monthly net per active rider on a managed fleet</p>
          </motion.div>
        </FadeUp>
      </div>
    </section>
  );
}
