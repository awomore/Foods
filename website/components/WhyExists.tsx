import Image from 'next/image';
import { FadeUp, FadeIn } from './ui/FadeUp';

const pillars = [
  {
    title: 'Your own URL and storefront',
    body: 'Every cook gets a personal page — foodsbyme.com/@yourname. Share it anywhere. Customers browse your menu and order directly from your storefront.',
  },
  {
    title: 'Bring your social following',
    body: 'Connect your Instagram or TikTok during onboarding. Your existing audience is notified and can follow you on FOODSbyme automatically.',
  },
  {
    title: 'Hire a chef, not just a menu',
    body: 'Need someone to cook at your home, event, or gathering? Book a vetted private chef for any occasion.',
  },
  {
    title: 'Cooks are creators',
    body: 'Every cook has a brand, an identity, and a culinary voice. Their kitchen is their studio — and this is their platform.',
  },
];

export default function WhyExists() {
  return (
    <section id="why-exists" className="py-16 md:py-24 bg-warm/30 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Pillars */}
          <div>
            <FadeUp className="mb-8">
              <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">Our purpose</p>
              <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.8rem)] text-ink leading-[1.1] tracking-tight">
                More than delivery.<br />
                <em className="font-normal italic">A community.</em>
              </h2>
            </FadeUp>

            <div className="space-y-7">
              {pillars.map((pillar, i) => (
                <FadeUp key={pillar.title} delay={i * 0.1}>
                  <div className="border-l-[1.5px] border-spice pl-5">
                    <h3 className="font-serif text-lg text-ink font-medium mb-1.5">{pillar.title}</h3>
                    <p className="text-stone text-sm leading-relaxed font-light">{pillar.body}</p>
                  </div>
                </FadeUp>
              ))}
            </div>

            <FadeUp delay={0.3} className="mt-8 flex gap-4">
              <a href="#cta" className="inline-flex items-center gap-2 px-5 py-3 bg-ink text-cream text-sm font-medium rounded-full hover:bg-charcoal transition-colors">
                Get the app
              </a>
              <a href="mailto:hello@foodsbyme.com" className="inline-flex items-center gap-2 px-5 py-3 border border-border text-ink text-sm font-medium rounded-full hover:bg-warm/50 transition-colors">
                Join as a cook
              </a>
            </FadeUp>
          </div>

          {/* Image — real kitchen with African chef */}
          <FadeIn className="relative h-[360px] md:h-[460px] rounded-3xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1636447155412-d57350005073?auto=format&fit=crop&w=900&q=85"
              alt="African chef cooking over a grill at a community food event"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-ink/10" />
            {/* Social proof overlay */}
            <div className="absolute top-5 right-5 bg-cream/95 backdrop-blur-sm rounded-2xl px-3 py-2.5 border border-border/30">
              <p className="text-xs font-semibold text-ink">Social platform</p>
              <p className="text-[10px] text-muted mt-0.5">Follow · Review · Share</p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
