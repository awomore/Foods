const PERKS = [
  { emoji: '💰', title: 'Keep more of what you earn', body: 'We charge a flat 3.75% platform fee — one of the lowest in the market. The rest is yours.' },
  { emoji: '📅', title: 'Cook on your schedule', body: 'Set your availability by the day. Go live when you\'re ready, offline when you\'re not. No shifts, no minimum hours.' },
  { emoji: '👥', title: 'Build your own following', body: 'Customers follow their favourite cooks. Build a loyal base that orders from you again and again.' },
  { emoji: '📦', title: 'We handle payments & logistics', body: 'Focus on cooking. We handle secure payment collection, rider coordination, and customer support.' },
];

export default function ForCooks() {
  return (
    <section id="for-cooks" className="py-24 bg-ink text-white overflow-hidden relative">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-spice opacity-10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-orange-400 opacity-5 blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-16 items-center">
        {/* Copy */}
        <div>
          <p className="text-spice text-sm font-semibold uppercase tracking-widest mb-4">For cooks</p>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight mb-6">
            Turn your cooking<br />into a business
          </h2>
          <p className="text-white/60 text-lg leading-relaxed mb-8">
            You already cook every day. FOODSbyme lets you earn from it — without a restaurant, without a boss, on your own terms.
          </p>
          <a
            href="#waitlist"
            className="inline-block px-6 py-3.5 bg-spice text-white font-semibold rounded-full hover:bg-ember transition-colors text-sm shadow-lg shadow-spice/30"
          >
            Apply to cook on FOODSbyme
          </a>
        </div>

        {/* Perks grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PERKS.map((p) => (
            <div key={p.title} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 transition-colors">
              <div className="text-2xl mb-3">{p.emoji}</div>
              <h3 className="font-semibold text-white text-sm mb-1.5">{p.title}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
