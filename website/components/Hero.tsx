import Image from 'next/image';
import { StoreBadge } from './StoreBadge';

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-parchment overflow-hidden flex items-center">

      {/* Right-side food image panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-[52%] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=1400&q=85"
          alt="Home-cooked meal"
          fill
          className="object-cover"
          priority
        />
        {/* Gradient fade to left */}
        <div className="absolute inset-0 bg-gradient-to-r from-parchment via-parchment/60 to-transparent md:via-parchment/20" />
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-parchment to-transparent" />
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-6 md:px-10 w-full pt-28 pb-20 md:py-32">
        <div className="max-w-xl">
          {/* Label */}
          <p className="text-spice text-xs font-semibold uppercase tracking-[0.2em] mb-6">
            Now in Lagos
          </p>

          {/* Headline */}
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-ink leading-[1.08] mb-6">
            The home kitchen,{' '}
            <span className="italic font-normal">delivered.</span>
          </h1>

          <p className="text-stone text-lg leading-relaxed mb-10 max-w-md">
            Discover talented home cooks in your neighbourhood. Order meals made from scratch — real ingredients, real kitchens, real people.
          </p>

          {/* Store badges */}
          <div className="flex flex-wrap gap-3 mb-14">
            <StoreBadge store="apple" variant="dark" />
            <StoreBadge store="google" variant="dark" />
          </div>

          {/* Stats row */}
          <div className="flex gap-10 pt-10 border-t border-warm">
            {[
              { value: '500+', label: 'Home cooks' },
              { value: '12,000+', label: 'Meals delivered' },
              { value: '4.9 / 5', label: 'Average rating' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="font-serif text-2xl text-ink">{value}</p>
                <p className="text-xs text-muted mt-1 font-medium tracking-wide uppercase">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating phone mockup */}
      <div className="absolute right-[5%] md:right-[8%] bottom-0 hidden lg:block translate-y-10">
        <PhoneMockup />
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative w-[260px] h-[530px]">
      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[40px] bg-ink shadow-2xl overflow-hidden border-[5px] border-[#2a2218]">
        {/* Dynamic island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-ink rounded-full z-10" />

        {/* App content */}
        <div className="bg-[#FAF6F1] h-full pt-12 overflow-hidden">
          {/* Header */}
          <div className="px-4 pb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-[#9C8D80]">Good afternoon</p>
              <p className="text-xs font-semibold text-[#1A1208] mt-0.5">What are you craving?</p>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#C84B31] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="mx-4 mb-3 bg-white rounded-xl px-3 py-2 border border-[#F0E8DC]">
            <p className="text-[10px] text-[#9C8D80]">Search cooks or dishes…</p>
          </div>

          {/* Cook card */}
          <div className="mx-4 bg-white rounded-2xl overflow-hidden shadow-sm border border-[#F0E8DC] mb-3">
            <div className="relative h-28 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1476224203421-9ac39bcb3df1?auto=format&fit=crop&w=400&q=80"
                alt="Food"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-0.5 text-[9px] font-semibold text-[#1A1208]">
                Open now
              </div>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#1A1208]">Mama Titi</p>
                <p className="text-[9px] text-amber-600 font-medium">4.9 ★</p>
              </div>
              <p className="text-[10px] text-[#9C8D80] mt-0.5">Jollof Rice, Egusi, Pepper Soup</p>
              <div className="mt-2.5 flex gap-2">
                <div className="flex-1 bg-[#C84B31] rounded-lg py-1.5 text-center">
                  <p className="text-[10px] text-white font-semibold">Order now</p>
                </div>
                <div className="w-7 border border-[#F0E8DC] rounded-lg flex items-center justify-center">
                  <p className="text-[10px]">+</p>
                </div>
              </div>
            </div>
          </div>

          {/* Second card peek */}
          <div className="mx-4 bg-white rounded-2xl overflow-hidden border border-[#F0E8DC]">
            <div className="relative h-16 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80"
                alt="Food"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#1A1208]">Chef Adaeze</p>
                <p className="text-[9px] text-amber-600 font-medium">5.0 ★</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom nav bar */}
        <div className="absolute bottom-0 inset-x-0 h-14 bg-white border-t border-[#F0E8DC] flex items-center justify-around px-6 pb-2">
          {['Home', 'Discover', 'Orders', 'You'].map((item) => (
            <div key={item} className="flex flex-col items-center gap-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${item === 'Home' ? 'bg-[#C84B31]' : 'bg-[#E8E0D8]'}`} />
              <p className={`text-[8px] ${item === 'Home' ? 'text-[#C84B31] font-semibold' : 'text-[#9C8D80]'}`}>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
