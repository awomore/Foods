'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Section, SectionHeading } from '@/components/ui/Section';
import { TESTIMONIALS } from '@/lib/data';

export default function SuccessStories() {
  return (
    <Section tone="cream">
      <div className="container-x">
        <SectionHeading
          kicker="From the community"
          title={<>Creators, customers, and partners — <span className="text-gradient-spice italic">all building here</span></>}
        />
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="card p-7 flex flex-col"
            >
              <span className="font-serif text-5xl text-spice/30 leading-none mb-2" aria-hidden>“</span>
              <blockquote className="text-ink text-[17px] leading-relaxed font-light flex-1">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 pt-5 border-t border-border">
                <span className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                  <Image src={t.avatar} alt={t.name} fill sizes="40px" className="object-cover" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-ink">{t.name}</span>
                  <span className="block text-[12px] text-muted">{t.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </Section>
  );
}
