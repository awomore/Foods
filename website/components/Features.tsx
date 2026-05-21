const FEATURES = [
  {
    emoji: '🏠',
    title: 'Real home-cooked food',
    body: 'No restaurant markup, no shortcuts. Every meal is made by a real person in a real kitchen with ingredients they chose themselves.',
  },
  {
    emoji: '🥗',
    title: 'Allergen-aware ordering',
    body: 'Set your allergen profile once. Cooks are automatically flagged when their dishes contain ingredients you need to avoid.',
  },
  {
    emoji: '⭐',
    title: 'Verified cooks only',
    body: 'Every cook on the platform is ID-verified and food-safety certified. You always know who is cooking your food.',
  },
  {
    emoji: '📍',
    title: 'Hyper-local discovery',
    body: 'Find cooks who are actually close to you. Less travel time means fresher food on your table.',
  },
  {
    emoji: '💬',
    title: 'Direct communication',
    body: 'Talk to your cook before and after ordering. Request substitutions, ask about spice levels, or leave a review.',
  },
  {
    emoji: '🔒',
    title: 'Secure payments',
    body: 'Every transaction is protected. Pay with card, bank transfer, or USSD — funds are held securely until your order is delivered.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-cream">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-16">
          <p className="text-spice text-sm font-semibold uppercase tracking-widest mb-3">Why FOODSbyme</p>
          <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">
            Built for people who<br />care about what they eat
          </h2>
          <p className="text-stone max-w-lg mx-auto leading-relaxed">
            We built FOODSbyme because restaurant food isn&apos;t always what you want — sometimes you want something made with love, not a timer.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 border border-warm hover:border-spice/30 hover:shadow-lg hover:shadow-spice/5 transition-all duration-200"
            >
              <div className="text-3xl mb-4">{f.emoji}</div>
              <h3 className="font-semibold text-ink mb-2">{f.title}</h3>
              <p className="text-stone text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
