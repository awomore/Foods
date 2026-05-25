import { FadeUp } from './ui/FadeUp';

const steps = [
  {
    number: '01',
    title: 'Discover cooks near you',
    description:
      'Browse a curated feed of home cooks in your city. Filter by cuisine, distance, availability, and dietary needs. Every profile tells a real story.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Order from a real kitchen',
    description:
      'Choose your meal, schedule delivery or collection, and pay securely. You know exactly who made your food, what went into it, and when it will arrive.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Join their community',
    description:
      'Leave a review, follow your favourite cooks, gift meals to someone you love, and become a regular at tables that matter to you.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-warm/40">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Header */}
        <FadeUp className="mb-16 md:mb-20 max-w-2xl">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-4">How it works</p>
          <h2 className="font-serif text-[clamp(2rem,4vw,3.2rem)] text-ink leading-[1.1] tracking-tight">
            From discovery to delivery,<br />
            <em className="font-normal italic">beautifully simple.</em>
          </h2>
        </FadeUp>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-px bg-transparent md:bg-border/50 rounded-3xl overflow-hidden">
          {steps.map((step, i) => (
            <FadeUp key={step.number} delay={i * 0.12}>
              <div className="bg-parchment md:bg-cream p-8 md:p-10 lg:p-12 border-b border-border md:border-b-0 last:border-b-0 h-full">
                {/* Number + icon row */}
                <div className="flex items-center justify-between mb-8">
                  <span className="font-serif text-5xl text-border font-medium select-none">{step.number}</span>
                  <span className="text-stone">{step.icon}</span>
                </div>

                {/* Content */}
                <h3 className="font-serif text-xl text-ink font-medium mb-3 leading-tight">{step.title}</h3>
                <p className="text-stone text-sm leading-relaxed font-light">{step.description}</p>
              </div>
            </FadeUp>
          ))}
        </div>

        {/* Bottom note */}
        <FadeUp delay={0.3} className="mt-12 text-center">
          <p className="text-muted text-sm font-light">
            Available in Lagos. Expanding across Nigeria in 2025.
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
