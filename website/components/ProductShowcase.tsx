'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeUp, FadeIn } from './ui/FadeUp';

const features = [
  {
    id: 'discovery',
    label: 'Discover',
    title: 'A social feed of real kitchens',
    description: 'Follow cooks you love, see what your community is ordering, and discover new kitchens through shared meals — not algorithms.',
    items: [
      { name: "Mama Titi's Kitchen", tag: 'Open now', cuisine: 'Jollof · Egusi · Ofe Akwu' },
      { name: 'Chef Adaeze', tag: '5.0 ★', cuisine: 'Afro-Fusion · Small Chops' },
    ],
  },
  {
    id: 'social',
    label: 'Community',
    title: 'Follow the cooks you love',
    description: 'Like a real neighbourhood — follow your favourite cooks, see their daily specials, share meals with friends, and build your culinary circle.',
    items: [
      { name: 'Iya Bisi Foods', tag: '2.1k followers', cuisine: 'You follow this cook' },
      { name: 'Chef Emeka', tag: 'New post', cuisine: 'Ofe Onugbu is ready today' },
    ],
  },
  {
    id: 'booking',
    label: 'Book a Chef',
    title: 'Hire a private chef for any occasion',
    description: 'Need a chef at your home, office event, birthday, or wedding? Browse vetted private chefs and book a session in minutes.',
    items: [
      { name: 'Chef Adaeze', tag: 'Private Chef', cuisine: 'Available Sat & Sun' },
      { name: 'Chef Emeka', tag: '4.9 ★', cuisine: 'Events up to 50 guests' },
    ],
  },
  {
    id: 'gifting',
    label: 'Gifting',
    title: 'Send someone a home-cooked meal',
    description: 'Gift a meal to someone you love. Add a personal note, schedule delivery, and let a real cook do the caring.',
    items: [
      { name: 'Gift to Sola', tag: 'Scheduled', cuisine: 'Sunday, 1:00 PM' },
      { name: 'Gift to Mum', tag: 'Delivered', cuisine: 'Birthday surprise' },
    ],
  },
];

export default function ProductShowcase() {
  const [active, setActive] = useState(0);

  return (
    <section id="product" className="py-16 md:py-24 bg-ink overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <FadeUp className="mb-10 md:mb-12">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">The product</p>
          <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.8rem)] text-cream leading-[1.1] tracking-tight max-w-lg">
            Order meals, hire chefs,<br />
            <em className="font-normal italic text-cream/60">build your community.</em>
          </h2>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Feature tabs */}
          <div className="order-2 lg:order-1 space-y-1">
            {features.map((feat, i) => (
              <button key={feat.id} onClick={() => setActive(i)}
                className={`w-full text-left px-5 py-5 rounded-2xl transition-all duration-300 ${
                  active === i ? 'bg-white/10 border border-white/15' : 'border border-transparent hover:bg-white/5'
                }`}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className={`text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                    active === i ? 'text-spice' : 'text-cream/40'
                  }`}>{feat.label}</span>
                  {active === i && <motion.div layoutId="active-dot" className="w-1 h-1 rounded-full bg-spice" />}
                </div>
                <h3 className={`font-serif text-lg font-medium leading-tight transition-colors ${
                  active === i ? 'text-cream' : 'text-cream/50'
                }`}>{feat.title}</h3>
                <AnimatePresence>
                  {active === i && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="text-cream/60 text-sm leading-relaxed mt-2 font-light overflow-hidden">
                      {feat.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>

          {/* Phone mockup */}
          <div className="order-1 lg:order-2 flex justify-center">
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
      <div className="absolute inset-0 rounded-[44px] bg-[#0E0B08] shadow-warm-xl border-[5px] border-[#1A1512] overflow-hidden">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#0E0B08] rounded-full z-10" />
        <AnimatePresence mode="wait">
          <motion.div key={feature.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="h-full bg-[#FFFFFF] pt-12 pb-14 overflow-hidden">
            <div className="px-5 pb-3 border-b border-[#E5E7EB]/60 mb-3">
              <p className="text-[9px] text-[#6B7280] uppercase tracking-wider">{feature.label}</p>
              <p className="text-sm font-semibold text-[#111827] font-serif mt-0.5">{feature.title.split(',')[0]}</p>
            </div>
            <div className="mx-4 mb-3 bg-white rounded-xl px-3 py-2 border border-[#E5E7EB]">
              <p className="text-[9px] text-[#6B7280]">Search cooks, meals, chefs&hellip;</p>
            </div>
            {feature.items.map((item, i) => (
              <div key={i} className="mx-4 mb-3 bg-white rounded-2xl overflow-hidden border border-[#E5E7EB]">
                <div className="h-16 bg-gradient-to-br from-[#E5E7EB] to-[#E5E7EB] relative overflow-hidden">
                  <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-amber-900 to-orange-800" />
                  <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-0.5 text-[8px] font-semibold text-[#111827]">{item.tag}</div>
                </div>
                <div className="p-3">
                  <p className="text-[11px] font-semibold text-[#111827]">{item.name}</p>
                  <p className="text-[9px] text-[#6B7280] mt-0.5">{item.cuisine}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
        <div className="absolute bottom-0 inset-x-0 h-12 bg-white border-t border-[#E5E7EB] flex items-center justify-around px-4 pb-1">
          {['Home', 'Discover', 'Orders', 'You'].map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div className={`w-1 h-1 rounded-full ${i === 0 ? 'bg-[#FF6B35]' : 'bg-[#E5E7EB]'}`} />
              <p className={`text-[7px] font-medium ${i === 0 ? 'text-[#FF6B35]' : 'text-[#6B7280]'}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
