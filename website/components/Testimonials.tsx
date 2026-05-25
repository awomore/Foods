import { FadeUp } from './ui/FadeUp';

const testimonials = [
  {
    quote:
      "I've tried every food app in Lagos. Nothing comes close to this. The meal from Chef Adaeze felt like visiting her home — the warmth, the care, even the packaging. I follow her calendar now like appointments.",
    name: 'Amaka Okonkwo',
    role: 'Regular customer',
    location: 'Lekki, Lagos',
    initials: 'AO',
    color: 'bg-spice',
  },
  {
    quote:
      "FOODSbyme gave my cooking a real identity. I had loyal customers before, but the platform gave me tools to tell my story properly — my bio, my photos, my schedule. My orders doubled in two months.",
    name: 'Tunde Akinsola',
    role: 'Cook — Emeka\'s Smokehouse',
    location: 'Victoria Island, Lagos',
    initials: 'TA',
    color: 'bg-stone',
  },
  {
    quote:
      "I sent my mum a birthday meal through the gifting feature. She called me crying — not because of the food (though it was perfect), but because of the note I wrote. The platform made space for that.",
    name: 'David Kelechi',
    role: 'Regular customer',
    location: 'Ikeja, Lagos',
    initials: 'DK',
    color: 'bg-ink',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-24 md:py-32 bg-parchment overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Header */}
        <FadeUp className="mb-14 md:mb-18">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-4">What people say</p>
          <h2 className="font-serif text-[clamp(2rem,4vw,3.2rem)] text-ink leading-[1.1] tracking-tight max-w-sm">
            From tables<br />
            <em className="font-normal italic">across Lagos.</em>
          </h2>
        </FadeUp>

        {/* Testimonial cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {testimonials.map((t, i) => (
            <FadeUp key={t.name} delay={i * 0.1}>
              <article className="flex flex-col h-full bg-cream border border-border/50 rounded-3xl p-7 md:p-8">
                {/* Quote mark */}
                <span className="font-serif text-6xl text-border leading-none select-none mb-4" aria-hidden>
                  &ldquo;
                </span>

                {/* Quote text */}
                <blockquote className="font-serif text-[15px] text-ink leading-relaxed flex-1 mb-8 italic font-normal">
                  {t.quote}
                </blockquote>

                {/* Attribution */}
                <div className="flex items-center gap-3 pt-6 border-t border-border/60">
                  <div
                    className={`w-9 h-9 rounded-full ${t.color} flex items-center justify-center flex-shrink-0`}
                    aria-hidden
                  >
                    <span className="text-[11px] font-semibold text-cream">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <p className="text-[11px] text-muted mt-0.5">{t.role} &middot; {t.location}</p>
                  </div>
                </div>
              </article>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
