'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/Section';
import { CREATORS } from '@/lib/data';

export default function FeaturedCreators() {
  return (
    <Section tone="cream">
      <div className="container-x">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <SectionHeading
            kicker="Featured creators"
            title={<>Real kitchens. Real people. <span className="text-gradient-spice italic">Real followings.</span></>}
          />
          <a href="/for-customers" className="btn-ghost btn-sm self-start md:self-end whitespace-nowrap">
            Explore the app →
          </a>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CREATORS.map((c, i) => (
            <motion.article
              key={c.handle}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="card overflow-hidden group hover:shadow-warm-lg transition-shadow duration-500"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={c.image}
                  alt={`${c.specialty} — ${c.kitchen}`}
                  fill
                  sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
                <div className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 rounded-full bg-cream/90 backdrop-blur px-2.5 py-1 text-[12px] font-semibold text-ink">
                  <Star size={12} className="fill-gold text-gold" /> {c.rating.toFixed(1)}
                </div>
                <div className="absolute bottom-3.5 left-3.5 flex items-center gap-2.5">
                  <span className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-cream/80">
                    <Image src={c.avatar} alt={c.name} fill sizes="36px" className="object-cover" />
                  </span>
                  <span className="text-cream">
                    <span className="block text-[13px] font-semibold leading-none">{c.kitchen}</span>
                    <span className="block text-[11px] text-cream/70 mt-1">{c.followers} followers</span>
                  </span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-[15px] text-ink font-medium leading-snug">{c.specialty}</p>
                <p className="text-[13px] text-muted mt-1">{c.name} · {c.city}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-warm/60 text-stone font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </Section>
  );
}
