import Image from 'next/image';
import { StoreBadge } from './StoreBadge';

export default function Download() {
  return (
    <section id="download" className="bg-white py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">

        {/* Top copy */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-spice text-xs font-semibold uppercase tracking-[0.2em] mb-5">Get the app</p>
          <h2 className="font-serif text-4xl md:text-5xl text-ink leading-tight mb-5">
            Download FOODSbyme
          </h2>
          <p className="text-stone leading-relaxed mb-8">
            Available on iOS and Android. Thousands of home-cooked meals waiting — from cooks just around the corner.
          </p>

          <div className="flex justify-center flex-wrap gap-3">
            <StoreBadge store="apple" variant="dark" />
            <StoreBadge store="google" variant="dark" />
          </div>
        </div>

        {/* Two phones */}
        <div className="flex justify-center items-end gap-4 md:gap-8 mt-4">

          {/* Phone 1 — browse screen */}
          <div className="relative w-[200px] h-[406px] md:w-[240px] md:h-[488px] -mb-6">
            <div className="absolute inset-0 rounded-[36px] bg-ink shadow-2xl overflow-hidden border-[4px] border-[#2a2218]">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-ink rounded-full z-10" />
              <div className="bg-[#FFFFFF] h-full pt-9">
                <div className="px-3 pb-2">
                  <p className="text-[8px] text-[#6B7280]">Near Lekki Phase 1</p>
                  <p className="text-[10px] font-semibold text-[#111827]">Cooks near you</p>
                </div>
                <div className="relative h-36 mx-3 rounded-xl overflow-hidden mb-3">
                  <Image
                    src="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=400&q=80"
                    alt="Food"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-2">
                    <p className="text-white text-[9px] font-semibold">Mama Titi</p>
                    <p className="text-white/70 text-[8px]">Jollof, Egusi, Soups</p>
                  </div>
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full px-2 py-0.5">
                    <p className="text-white text-[7px] font-semibold">Open</p>
                  </div>
                </div>
                <div className="px-3 space-y-2">
                  {['Chef Dele', 'Auntie Bisi', 'Iya Risi'].map((name) => (
                    <div key={name} className="flex items-center gap-2 bg-white rounded-xl p-2 border border-[#F5F5F5]">
                      <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex-shrink-0" />
                      <div>
                        <p className="text-[9px] font-semibold text-[#111827]">{name}</p>
                        <p className="text-[8px] text-[#6B7280]">25 min away</p>
                      </div>
                      <p className="ml-auto text-[8px] text-amber-600">4.8 ★</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Phone 2 — order tracking screen (taller / center) */}
          <div className="relative w-[220px] h-[448px] md:w-[260px] md:h-[530px] z-10">
            <div className="absolute inset-0 rounded-[40px] bg-ink shadow-2xl overflow-hidden border-[5px] border-[#2a2218]">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-ink rounded-full z-10" />
              <div className="bg-[#FFFFFF] h-full pt-12">
                <div className="px-4 mb-3">
                  <p className="text-[9px] text-[#6B7280]">Order #FBM-4821</p>
                  <p className="text-xs font-semibold text-[#111827]">Your order is on the way</p>
                </div>

                {/* Map placeholder */}
                <div className="relative h-36 mx-4 rounded-xl overflow-hidden mb-3 bg-[#E8E0D8]">
                  <Image
                    src="https://images.unsplash.com/photo-1476224203421-9ac39bcb3df1?auto=format&fit=crop&w=400&q=80"
                    alt="Meal"
                    fill
                    className="object-cover opacity-20"
                  />
                  {/* Fake map dots */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-spice shadow-lg shadow-spice/40" />
                  </div>
                  <div className="absolute bottom-2 inset-x-2 bg-white/90 rounded-lg px-2 py-1.5">
                    <p className="text-[9px] font-semibold text-[#111827]">Rider arriving in 8 min</p>
                    <p className="text-[8px] text-[#6B7280]">Emeka — Honda CB 125</p>
                  </div>
                </div>

                {/* Order summary */}
                <div className="mx-4 bg-white rounded-xl p-3 border border-[#F5F5F5]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-[#F5F5F5]">
                      <Image
                        src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80"
                        alt="Cook"
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-[#111827]">Mama Titi</p>
                      <p className="text-[8px] text-[#6B7280]">Jollof Rice + Chicken</p>
                    </div>
                    <p className="ml-auto text-[9px] font-semibold text-[#111827]">₦4,500</p>
                  </div>
                  {/* Status steps */}
                  <div className="flex items-center gap-1 mt-2">
                    {['Confirmed', 'Preparing', 'Picked up', 'Delivered'].map((step, i) => (
                      <div key={step} className="flex items-center gap-1 flex-1">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i < 3 ? 'bg-spice' : 'bg-[#E8E0D8]'}`} />
                        {i < 3 && <div className={`h-px flex-1 ${i < 2 ? 'bg-spice' : 'bg-[#E8E0D8]'}`} />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rate cook */}
                <div className="mx-4 mt-3 flex items-center justify-between bg-spice/10 rounded-xl px-3 py-2">
                  <p className="text-[9px] font-medium text-spice">Rate this cook</p>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => <div key={n} className="w-3 h-3 rounded-sm bg-spice/20" />)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Phone 3 — cook profile */}
          <div className="relative w-[200px] h-[406px] md:w-[240px] md:h-[488px] -mb-6">
            <div className="absolute inset-0 rounded-[36px] bg-ink shadow-2xl overflow-hidden border-[4px] border-[#2a2218]">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-ink rounded-full z-10" />
              <div className="bg-[#FFFFFF] h-full pt-9">
                {/* Cook hero image */}
                <div className="relative h-32 overflow-hidden">
                  <Image
                    src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80"
                    alt="Cook profile"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-2 left-3">
                    <p className="text-white text-[10px] font-semibold">Chef Adaeze</p>
                    <p className="text-white/70 text-[8px]">Lekki Phase 1 · 5.0 ★</p>
                  </div>
                </div>
                {/* Menu items */}
                <div className="px-3 pt-2 space-y-1.5">
                  <p className="text-[8px] font-semibold text-[#6B7280] uppercase tracking-wide">Today&apos;s menu</p>
                  {[
                    { name: 'Egusi Soup + Eba', price: '₦3,200' },
                    { name: 'Ofe Akwu + Rice', price: '₦3,800' },
                    { name: 'Pepper Soup', price: '₦2,500' },
                  ].map(({ name, price }) => (
                    <div key={name} className="flex items-center justify-between bg-white rounded-lg px-2 py-1.5 border border-[#F5F5F5]">
                      <p className="text-[9px] text-[#111827]">{name}</p>
                      <p className="text-[8px] font-semibold text-spice">{price}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
