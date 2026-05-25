import Image from 'next/image';
import { FadeUp, FadeIn } from './ui/FadeUp';

const pillars = [
  {
    title: 'Cooks are creators',
    body: 'Every home cook on this platform is a creative professional. Their kitchen is their studio. Their food is their signature.',
  },
  {
    title: 'Food is personal',
    body: 'The best meal you ever had was made by someone who cared. That care is the ingredient we cannot manufacture, but we can celebrate.',
  },
  {
    title: 'Communities form around tables',
    body: 'We believe the most important conversations happen over food. FOODSbyme creates the conditions for those moments.',
  },
];

export default function WhyExists() {
  return (
    <section id="why-exists" className="py-24 md:py-36 bg-parchment overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Large editorial statement */}
        <FadeUp className="mb-20 md:mb-28 max-w-3xl">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-6">Our purpose</p>
          <blockquote className="font-serif text-[clamp(1.8rem,4vw,3rem)] text-ink leading-[1.15] tracking-tight">
            &ldquo;Food is one of the most intimate things one person can offer another. We built FOODSbyme so that intimacy could scale — without losing its soul.&rdquo;
          </blockquote>
        </FadeUp>

        {/* Two-column layout: image + pillars */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image */}
          <FadeIn className="relative h-[400px] md:h-[520px] rounded-3xl overflow-hidden order-2 lg:order-1">
            <Image
              src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=85"
              alt="A cook preparing food with care in a home kitchen"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {/* Subtle grain overlay for editorial feel */}
            <div className="absolute inset-0 bg-ink/5 mix-blend-multiply" />
          </FadeIn>

          {/* Pillars */}
          <div className="order-1 lg:order-2 space-y-10">
            {pillars.map((pillar, i) => (
              <FadeUp key={pillar.title} delay={i * 0.12}>
                <div className="border-l-[1.5px] border-spice pl-6">
                  <h3 className="font-serif text-xl text-ink font-medium mb-2">{pillar.title}</h3>
                  <p className="text-stone text-sm leading-relaxed font-light">{pillar.body}</p>
                </div>
              </FadeUp>
            ))}

            <FadeUp delay={0.36}>
              <div className="pt-4">
                <a
                  href="#cta"
                  className="inline-flex items-center gap-2 text-sm font-medium text-spice hover:text-ember transition-colors group"
                >
                  Join as a cook
                  <span className="inline-block transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
                    &rarr;
                  </span>
                </a>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
