const STEPS = [
  {
    n: '01',
    title: 'Browse local cooks',
    body: 'Discover home cooks in your area. Filter by cuisine, rating, dietary needs, or "open now" — every profile shows what\'s cooking today.',
    emoji: '🔍',
  },
  {
    n: '02',
    title: 'Place your order',
    body: 'Pick your meal, add a note, and pay securely. Your cook sees your order instantly and starts preparing your food fresh.',
    emoji: '🛒',
  },
  {
    n: '03',
    title: 'Receive & enjoy',
    body: 'Track your order in real time. Meals are delivered hot, or you can arrange pickup directly with your cook.',
    emoji: '🍽️',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-16">
          <p className="text-spice text-sm font-semibold uppercase tracking-widest mb-3">Simple process</p>
          <h2 className="font-serif text-4xl md:text-5xl text-ink">How it works</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {STEPS.map((step) => (
            <div key={step.n} className="relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-8 left-[calc(50%+3rem)] w-[calc(100%-6rem)] h-px border-t border-dashed border-warm" />

              <div className="flex flex-col items-start gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-warm flex items-center justify-center text-3xl">
                    {step.emoji}
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-spice text-white text-[10px] font-bold flex items-center justify-center">
                    {step.n.slice(1)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-ink text-lg mb-2">{step.title}</h3>
                  <p className="text-stone text-sm leading-relaxed">{step.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
