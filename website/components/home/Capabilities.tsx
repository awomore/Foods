'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { CalendarDays, ChefHat, GraduationCap, Gift } from 'lucide-react';
import { Section, SectionHeading } from '@/components/ui/Section';

const features = [
  {
    icon: CalendarDays,
    eyebrow: 'Weekly menus',
    title: 'A rhythm people plan their week around',
    body: 'Creators publish a recurring menu — a Sunday jollof drop, a Friday pastry box. Followers subscribe, pre-order, and never miss it.',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
    span: 'lg:col-span-3',
  },
  {
    icon: ChefHat,
    eyebrow: 'Private chef',
    title: 'Book a private dining experience',
    body: 'Tasting menus and events, hosted or delivered, booked straight from a creator’s profile.',
    image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80',
    span: 'lg:col-span-2',
  },
  {
    icon: GraduationCap,
    eyebrow: 'Courses & products',
    title: 'Sell knowledge, not just meals',
    body: 'Cooking courses, spice guides, and downloadable recipes turn a creator’s expertise into recurring digital income.',
    image: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=900&q=80',
    span: 'lg:col-span-2',
  },
  {
    icon: Gift,
    eyebrow: 'Community gifting',
    title: 'Send a meal, build a community',
    body: 'Gift a dish to a friend, sponsor meals for a group, or rally a community around a creator you believe in.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
    span: 'lg:col-span-3',
  },
];

export default function Capabilities() {
  return (
    <Section tone="parchment">
      <div className="container-x">
        <SectionHeading
          align="center"
          kicker="One kitchen, many ways to earn"
          title={<>Everything a food creator needs to <span className="text-gradient-spice italic">build a business</span></>}
          intro="Not a single revenue stream, but a whole storefront. Each creator decides how they want to earn — and FOODS handles payments, delivery, and trust underneath."
        />

        <div className="mt-16 grid lg:grid-cols-5 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.eyebrow}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: (i % 2) * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className={`card overflow-hidden group ${f.span}`}
              >
                <div className="relative h-52 overflow-hidden">
                  <Image
                    src={f.image}
                    alt={f.title}
                    fill
                    sizes="(max-width:1024px) 100vw, 50vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-cream/90 backdrop-blur px-3 py-1.5">
                    <Icon size={15} className="text-spice" />
                    <span className="text-[12px] font-semibold text-ink">{f.eyebrow}</span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-serif text-xl text-ink mb-2">{f.title}</h3>
                  <p className="text-stone font-light leading-relaxed text-[15px]">{f.body}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
