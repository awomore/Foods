import Image from 'next/image';
import { FadeUp, FadeIn } from './ui/FadeUp';

const pillars = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    title: 'Verified cooks & chefs',
    body: 'Every cook is identity-verified and kitchen-inspected before their first listing. Private chefs hold additional certification.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
    title: 'Secure payments',
    body: 'Powered by Flutterwave. Card, bank transfer, or USSD. Your data never touches our servers.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Real reviews only',
    body: 'Only verified purchasers can review. No anonymous ratings. Every star is earned honestly.',
  },
];

export default function TrustSafety() {
  return (
    <section id="trust" className="py-16 md:py-24 bg-parchment overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Image — real kitchen */}
          <FadeIn className="relative h-[320px] md:h-[420px] rounded-3xl overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1709837167686-a2e33aad1bf0?auto=format&fit=crop&w=900&q=85"
              alt="Nigerian chef in kitchen apron preparing food"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-ink/20" />
            <div className="absolute bottom-5 left-5 bg-cream/95 backdrop-blur-sm rounded-2xl px-4 py-3 border border-border/30">
              <p className="text-[10px] text-muted uppercase tracking-widest font-medium mb-0.5">Hygiene rated</p>
              <p className="text-sm text-ink font-semibold font-serif">Every kitchen inspected</p>
            </div>
          </FadeIn>

          {/* Pillars */}
          <div>
            <FadeUp className="mb-8">
              <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">Trust &amp; safety</p>
              <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.8rem)] text-ink leading-[1.1] tracking-tight">
                Built on accountability,<br />
                <em className="font-normal italic">on both sides.</em>
              </h2>
            </FadeUp>

            <div className="space-y-0 divide-y divide-border/60">
              {pillars.map((pillar, i) => (
                <FadeUp key={pillar.title} delay={i * 0.1}>
                  <div className="py-6 flex gap-4">
                    <span className="text-spice flex-shrink-0 mt-0.5">{pillar.icon}</span>
                    <div>
                      <h3 className="font-serif text-lg text-ink font-medium mb-1.5">{pillar.title}</h3>
                      <p className="text-stone text-sm leading-relaxed font-light">{pillar.body}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>

            <FadeUp delay={0.3}>
              <a href="/support" className="inline-flex items-center gap-2 text-sm font-medium text-stone hover:text-ink transition-colors group mt-6 pt-6 border-t border-border/60 block">
                Visit our support centre
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
              </a>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
