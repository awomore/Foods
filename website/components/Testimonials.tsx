import Image from 'next/image';
import { FadeUp } from './ui/FadeUp';

const testimonials = [
  {
    quote: "The meal from Chef Adaeze felt like visiting her home — the warmth, the care, even the packaging. I follow her calendar like appointments now.",
    name: 'Amaka O.',
    role: 'Regular customer, Lekki',
    initials: 'AO',
    color: 'bg-spice',
  },
  {
    quote: "FOODSbyme gave my cooking a real identity. My orders doubled in two months. The platform respects what I do.",
    name: 'Chef Tunde A.',
    role: 'Cook — Emeka\'s Smokehouse, VI',
    initials: 'TA',
    color: 'bg-charcoal',
  },
  {
    quote: "I booked a private chef for my mum's 60th. The whole evening was flawless. I didn't know this was even possible in Lagos.",
    name: 'David K.',
    role: 'Private chef booking, Ikeja',
    initials: 'DK',
    color: 'bg-stone',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-16 md:py-24 bg-warm/30 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Full-width photo header */}
        <div className="relative rounded-3xl overflow-hidden mb-10 h-48 md:h-56">
          <Image
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80"
            alt="Nigerian local meal on a table"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/50 to-ink/20" />
          <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-12">
            <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-2">What people say</p>
            <h2 className="font-serif text-[clamp(1.6rem,3vw,2.5rem)] text-cream leading-[1.1] tracking-tight">
              From tables<br />
              <em className="font-normal italic">across Lagos.</em>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <FadeUp key={t.name} delay={i * 0.1}>
              <article className="flex flex-col h-full bg-cream border border-border/50 rounded-3xl p-6">
                <span className="font-serif text-5xl text-border leading-none select-none mb-3" aria-hidden>&ldquo;</span>
                <blockquote className="font-serif text-[14px] text-ink leading-relaxed flex-1 mb-6 italic">
                  {t.quote}
                </blockquote>
                <div className="flex items-center gap-3 pt-4 border-t border-border/60">
                  <div className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-[10px] font-semibold text-cream">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">{t.name}</p>
                    <p className="text-[11px] text-muted mt-0.5">{t.role}</p>
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
