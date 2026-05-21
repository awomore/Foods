export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-warm opacity-60 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] rounded-full bg-orange-100 opacity-40 blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-12 items-center">
        {/* Copy */}
        <div>
          <div className="inline-flex items-center gap-2 bg-warm rounded-full px-3 py-1 text-xs font-semibold text-spice mb-6 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-spice animate-pulse" />
            Now available in Lagos
          </div>

          <h1 className="font-serif text-5xl md:text-6xl leading-tight text-ink mb-6">
            Real food,<br />
            from real<br />
            <span className="text-spice">neighbours.</span>
          </h1>

          <p className="text-stone text-lg leading-relaxed mb-8 max-w-md">
            FOODSbyme connects you to talented home cooks in your area. Order authentic meals made fresh — jollof, egusi, pepper soup, and more.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="#waitlist"
              className="px-6 py-3.5 bg-spice text-white font-semibold rounded-full hover:bg-ember transition-colors text-sm shadow-lg shadow-spice/20"
            >
              Get early access
            </a>
            <a
              href="#how-it-works"
              className="px-6 py-3.5 border border-warm bg-white text-ink font-semibold rounded-full hover:bg-warm transition-colors text-sm"
            >
              How it works
            </a>
          </div>

          {/* Social proof numbers */}
          <div className="flex gap-8 mt-10 pt-10 border-t border-warm">
            {[
              { n: '500+', label: 'Home cooks' },
              { n: '12k+', label: 'Meals served' },
              { n: '4.9★', label: 'Average rating' },
            ].map(({ n, label }) => (
              <div key={label}>
                <p className="font-serif text-2xl text-ink font-bold">{n}</p>
                <p className="text-xs text-stone mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* App mockup */}
        <div className="relative flex justify-center md:justify-end">
          <div className="relative w-72 h-[580px]">
            {/* Phone shell */}
            <div className="absolute inset-0 rounded-[44px] bg-ink shadow-2xl overflow-hidden border-[6px] border-ink">
              {/* Status bar */}
              <div className="h-10 bg-[#FDF6EE] flex items-center justify-between px-6">
                <span className="text-[10px] font-bold text-ink">9:41</span>
                <div className="w-24 h-5 bg-ink rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-0" />
                <div className="flex gap-1 items-center">
                  <div className="w-3 h-2 border border-ink rounded-sm"><div className="w-2 h-full bg-ink rounded-sm" /></div>
                </div>
              </div>

              {/* App content simulation */}
              <div className="bg-[#FDF6EE] h-full px-4 pt-2 pb-6 overflow-hidden">
                <p className="font-serif text-lg text-ink mb-1">Good afternoon 👋</p>
                <p className="text-xs text-[#7C6F5E] mb-4">What are you craving today?</p>

                {/* Search bar */}
                <div className="bg-white rounded-xl px-3 py-2.5 text-xs text-[#7C6F5E] border border-[#F5E6D8] mb-4">
                  Search cooks or dishes…
                </div>

                {/* Cook cards */}
                {[
                  { name: 'Mama Titi', dish: 'Jollof & Fried Rice', rating: '4.9', time: '25 min', emoji: '🍚' },
                  { name: 'Chef Dele', dish: 'Pepper Soup, Suya', rating: '4.8', time: '20 min', emoji: '🍲' },
                  { name: 'Auntie Bisi', dish: 'Egusi, Pounded Yam', rating: '5.0', time: '35 min', emoji: '🥘' },
                ].map((cook) => (
                  <div key={cook.name} className="bg-white rounded-2xl mb-3 overflow-hidden border border-[#F5E6D8] shadow-sm">
                    <div className="h-20 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-4xl">
                      {cook.emoji}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-ink">{cook.name}</p>
                        <span className="text-[10px] text-amber-600">★ {cook.rating}</span>
                      </div>
                      <p className="text-[10px] text-[#7C6F5E]">{cook.dish}</p>
                      <p className="text-[10px] text-[#C84B31] mt-1">{cook.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -right-6 top-24 bg-white rounded-2xl shadow-xl px-4 py-3 border border-warm">
              <p className="text-xs font-semibold text-ink">Order placed! 🎉</p>
              <p className="text-[10px] text-stone">Arriving in ~25 min</p>
            </div>

            {/* Floating badge 2 */}
            <div className="absolute -left-8 bottom-32 bg-spice rounded-2xl shadow-xl px-4 py-3 text-white">
              <p className="text-xs font-semibold">Fresh daily</p>
              <p className="text-[10px] opacity-80">No preservatives</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
