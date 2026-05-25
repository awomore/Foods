import { FadeUp } from './ui/FadeUp';

const trustPillars = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    title: 'Verified cooks',
    body: 'Every cook undergoes a thorough identity and kitchen verification process before their first listing goes live. We visit. We check. We certify.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    title: 'Kitchen hygiene standards',
    body: 'Cooks agree to and maintain our hygiene standards. Customer reports are acted on within 24 hours. We take food safety as seriously as food quality.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
    title: 'Secure payments',
    body: 'All transactions are processed through Flutterwave\'s secure infrastructure. Your card data never touches our servers. Refunds are instant.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Real reviews',
    body: 'Only customers who have completed an order can leave a review. No anonymous ratings. No gaming. Every star is earned honestly.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: 'On-time or refunded',
    body: 'If your order is significantly late and the cook cannot remedy it, you receive a full refund — no questions, no forms, no waiting.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    title: 'Cook welfare matters',
    body: 'FOODSbyme takes a fair platform fee so cooks keep the majority of their earnings. We protect cooks from abusive orders and unfair disputes.',
  },
];

export default function TrustSafety() {
  return (
    <section id="trust" className="py-24 md:py-32 bg-warm/30">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Header */}
        <FadeUp className="mb-14 md:mb-18 max-w-2xl">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-4">Trust &amp; safety</p>
          <h2 className="font-serif text-[clamp(2rem,4vw,3.2rem)] text-ink leading-[1.1] tracking-tight">
            Built on accountability,<br />
            <em className="font-normal italic">on both sides.</em>
          </h2>
          <p className="text-stone text-base leading-relaxed mt-5 font-light max-w-sm">
            A marketplace only works when everyone — cooks and customers — feels safe, respected, and protected.
          </p>
        </FadeUp>

        {/* Pillars grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/50 rounded-3xl overflow-hidden">
          {trustPillars.map((pillar, i) => (
            <FadeUp key={pillar.title} delay={i * 0.07}>
              <div className="bg-parchment p-7 md:p-8 h-full group hover:bg-cream transition-colors duration-300">
                <span className="inline-block text-spice mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
                  {pillar.icon}
                </span>
                <h3 className="font-serif text-lg text-ink font-medium mb-2">{pillar.title}</h3>
                <p className="text-stone text-sm leading-relaxed font-light">{pillar.body}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
