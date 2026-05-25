'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeUp } from './ui/FadeUp';

const features = [
  {
    id: 'discovery',
    label: 'Discover',
    title: 'A feed that feels personal',
    description:
      'The discovery feed surfaces cooks based on your taste history, location, and what your community is ordering. Not an algorithm — a recommendation from someone who knows you.',
    screen: {
      header: 'Good afternoon, Amaka',
      sub: 'What are you craving today?',
      items: [
        { name: "Mama Titi's Kitchen", tag: 'Open now', rating: '4.9', cuisine: 'Jollof · Egusi · Pepper Soup' },
        { name: 'Chef Adaeze', tag: 'Pre-order', rating: '5.0', cuisine: 'Suya · Afro-Fusion' },
      ],
    },
  },
  {
    id: 'profiles',
    label: 'Cook profiles',
    title: 'Every cook has a brand',
    description:
      'Cook profiles are rich, editorial pages — not just menus. See their story, their regulars, photos from real customers, and the schedules they keep. Follow the cooks you love.',
    screen: {
      header: "Mama Titi's Kitchen",
      sub: 'Lekki, Lagos · 238 reviews',
      items: [
        { name: 'Signature Jollof', tag: '₦2,800', rating: '★', cuisine: 'Serves 1–2 people' },
        { name: 'Egusi with Pounded Yam', tag: '₦3,200', rating: '★', cuisine: 'Serves 1–2 people' },
      ],
    },
  },
  {
    id: 'ordering',
    label: 'Ordering',
    title: 'Simple, considered checkout',
    description:
      'Place your order in seconds. Choose delivery or collection. Add dietary notes. Pay securely via card, bank transfer, or USSD. A confirmation lands in your inbox before you close the app.',
    screen: {
      header: 'Your order',
      sub: 'Mama Titi\'s Kitchen',
      items: [
        { name: 'Jollof Rice (2 packs)', tag: '₦5,600', rating: '', cuisine: 'With fried plantain' },
        { name: 'Pepper Soup', tag: '₦2,400', rating: '', cuisine: 'Assorted meat' },
      ],
    },
  },
  {
    id: 'gifting',
    label: 'Gifting',
    title: 'Send someone a home-cooked meal',
    description:
      'Gift a meal to a friend, a family member, or a colleague. Add a personal note. Schedule it for their birthday, a tough week, or just because. Food is the best gift.',
    screen: {
      header: 'Send a gift',
      sub: 'Choose a cook, write a note',
      items: [
        { name: 'Gift to Sola', tag: 'Scheduled', rating: '', cuisine: 'Sunday, 1:00 PM' },
        { name: 'Gift to Mum', tag: 'Delivered', rating: '', cuisine: 'Last Thursday' },
      ],
    },
  },
];

export default function ProductShowcase() {
  const [active, setActive] = useState(0);

  return (
    <section id="product" className="py-24 md:py-36 bg-ink overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Section header */}
        <FadeUp className="mb-14 md:mb-18">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-4">The product</p>
          <h2 className="font-serif text-[clamp(2rem,4vw,3.2rem)] text-cream leading-[1.1] tracking-tight max-w-lg">
            Everything you need,<br />
            <em className="font-normal italic text-warm/70">nothing you don&apos;t.</em>
          </h2>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Feature list */}
          <div className="order-2 lg:order-1">
            <div className="space-y-1 mb-10">
              {features.map((feat, i) => (
                <button
                  key={feat.id}
                  onClick={() => setActive(i)}
                  className={`w-full text-left px-5 py-5 rounded-2xl transition-all duration-400 group ${
                    active === i
                      ? 'bg-white/8 border border-white/12'
                      : 'border border-transparent hover:bg-white/4'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                        active === i ? 'text-spice' : 'text-stone'
                      }`}
                    >
                      {feat.label}
                    </span>
                    {active === i && (
                      <motion.div
                        layoutId="active-dot"
                        className="w-1 h-1 rounded-full bg-spice"
                      />
                    )}
                  </div>
                  <h3
                    className={`font-serif text-lg font-medium leading-tight transition-colors ${
                      active === i ? 'text-cream' : 'text-stone'
                    }`}
                  >
                    {feat.title}
                  </h3>
                  <AnimatePresence>
                    {active === i && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="text-stone text-sm leading-relaxed mt-2 font-light overflow-hidden"
                      >
                        {feat.description}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </button>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <FadeUp>
              <PhoneMockup feature={features[active]} />
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneMockup({ feature }: { feature: typeof features[0] }) {
  return (
    <div className="relative w-[260px] h-[520px] mx-auto">
      {/* Phone shell */}
      <div className="absolute inset-0 rounded-[44px] bg-[#0E0B08] shadow-warm-xl border-[5px] border-[#1A1512] overflow-hidden">
        {/* Dynamic island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#0E0B08] rounded-full z-10" />

        {/* Screen content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="h-full bg-[#FAF6F1] pt-12 pb-14 overflow-hidden"
          >
            {/* Status bar spacer */}
            <div className="px-5 pb-3 border-b border-[#E4D9CE]/60 mb-4">
              <p className="text-[9px] text-[#9C8D80]">{feature.screen.sub}</p>
              <p className="text-sm font-semibold text-[#1A1208] font-serif mt-0.5">{feature.screen.header}</p>
            </div>

            {/* Search */}
            <div className="mx-4 mb-4 bg-white rounded-xl px-3 py-2 border border-[#E4D9CE]">
              <p className="text-[9px] text-[#9C8D80]">Search cooks or dishes&hellip;</p>
            </div>

            {/* Cards */}
            {feature.screen.items.map((item, i) => (
              <div key={i} className="mx-4 mb-3 bg-white rounded-2xl overflow-hidden border border-[#E4D9CE]">
                <div className="relative h-20 bg-[#F0E8DC] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#E4D9CE] to-[#C8B8A8] opacity-60" />
                  <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-0.5 text-[8px] font-semibold text-[#1A1208]">
                    {item.tag}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-[#1A1208]">{item.name}</p>
                    {item.rating && <p className="text-[9px] text-amber-600 font-medium">{item.rating}</p>}
                  </div>
                  <p className="text-[9px] text-[#9C8D80] mt-0.5">{item.cuisine}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Bottom nav */}
        <div className="absolute bottom-0 inset-x-0 h-12 bg-white border-t border-[#E4D9CE] flex items-center justify-around px-4 pb-1">
          {['Home', 'Discover', 'Orders', 'You'].map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div className={`w-1 h-1 rounded-full ${i === 0 ? 'bg-[#C84B31]' : 'bg-[#E4D9CE]'}`} />
              <p className={`text-[7px] font-medium ${i === 0 ? 'text-[#C84B31]' : 'text-[#9C8D80]'}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
