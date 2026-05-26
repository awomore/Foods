import Image from 'next/image';
import { FadeUp, FadeIn } from './ui/FadeUp';

const steps = [
  {
    number: '01',
    title: 'Discover cooks near you',
    description: 'Browse home cooks and private chefs in your area. Filter by cuisine, diet, availability, and distance.',
  },
  {
    number: '02',
    title: 'Order or book a session',
    description: 'Order a meal for delivery or collection — or book a private chef for your home, event, or occasion.',
  },
  {
    number: '03',
    title: 'Follow and become a regular',
    description: 'Leave reviews, follow your favourite cooks, and join a community that takes food seriously.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-parchment overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Image */}
          <FadeIn className="relative h-[340px] md:h-[480px] rounded-3xl overflow-hidden order-2 lg:order-1">
            <Image
              src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85"
              alt="Nigerian home cook preparing a fresh meal in a real kitchen"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
            {/* Floating label */}
            <div className="absolute bottom-5 left-5 right-5">
              <div className="bg-cream/95 backdrop-blur-sm rounded-2xl px-4 py-3 border border-border/30 inline-block">
                <p className="text-[10px] text-muted uppercase tracking-widest font-medium mb-0.5">Local meal</p>
                <p className="text-sm text-ink font-semibold font-serif">Amala &amp; Ewedu by Iya Bisi</p>
              </div>
            </div>
          </FadeIn>

          {/* Steps */}
          <div className="order-1 lg:order-2">
            <FadeUp className="mb-8">
              <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">How it works</p>
              <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.8rem)] text-ink leading-[1.1] tracking-tight">
                Simple from first<br />
                <em className="font-normal italic">scroll to first bite.</em>
              </h2>
            </FadeUp>

            <div className="space-y-0 divide-y divide-border/60">
              {steps.map((step, i) => (
                <FadeUp key={step.number} delay={i * 0.1}>
                  <div className="py-6 flex gap-5">
                    <span className="font-serif text-3xl text-border font-medium select-none flex-shrink-0 w-10">{step.number}</span>
                    <div>
                      <h3 className="font-serif text-lg text-ink font-medium mb-1.5">{step.title}</h3>
                      <p className="text-stone text-sm leading-relaxed font-light">{step.description}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>

            <FadeUp delay={0.3}>
              <p className="text-muted text-xs mt-6 font-light pt-6 border-t border-border/60">
                Available in Lagos &mdash; expanding across Nigeria in 2025.
              </p>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
