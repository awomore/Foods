'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/Section';

const doors = [
  {
    label: 'I want to eat',
    title: 'Discover creators you’ll crave',
    body: 'Follow kitchens, order experiences, and join communities. Get the app.',
    href: '/for-customers',
    cta: 'For customers',
  },
  {
    label: 'I want to cook',
    title: 'Turn your kitchen into a following',
    body: 'Open a storefront, publish menus, sell courses, and earn real income.',
    href: '/for-creators',
    cta: 'For creators',
  },
  {
    label: 'I want to deliver',
    title: 'Build a delivery business',
    body: 'Power the network as a fleet partner — from one bike to a territory.',
    href: '/fleet',
    cta: 'Fleet partners',
  },
];

export default function ThreeDoors() {
  return (
    <Section tone="parchment">
      <div className="container-x">
        <SectionHeading
          align="center"
          kicker="Find your place"
          title={<>There’s a door here <span className="text-gradient-spice italic">for you</span></>}
        />
        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {doors.map((d, i) => (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={d.href}
                className="group block h-full card p-8 hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-500"
              >
                <p className="kicker">{d.label}</p>
                <h3 className="font-serif text-2xl text-ink mt-4 mb-3">{d.title}</h3>
                <p className="text-stone font-light leading-relaxed">{d.body}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-spice font-medium text-[14px]">
                  {d.cta}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}
