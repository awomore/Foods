'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const categories = [
  {
    title: 'Getting started',
    desc: 'Create an account, browse cooks, and place your first order.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    title: 'Orders & delivery',
    desc: 'Track orders, report issues, and understand delivery windows.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
      </svg>
    ),
  },
  {
    title: 'Payments & refunds',
    desc: 'Payment methods, receipts, and our full refund policy.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
  {
    title: 'Become a cook',
    desc: 'Apply, set up your storefront, and start taking orders.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    title: 'Private chef bookings',
    desc: 'Book a chef for events, dinners, birthdays, and weddings.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    title: 'Account & security',
    desc: 'Manage your profile, privacy, and account settings.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
];

const topics = [
  {
    label: 'For customers',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Download the FOODSbyme app, tap "Get started", and sign up with your phone number. Verification takes under 30 seconds.',
      },
      {
        q: 'How do I find cooks near me?',
        a: "Open the Discover tab and allow location access. You'll see home cooks and private chefs in your area, with real-time availability shown on each profile.",
      },
      {
        q: 'Can I follow specific cooks?',
        a: "Yes. Tap Follow on any cook's profile. You'll see their daily specials, new menus, and availability updates directly in your feed.",
      },
      {
        q: 'How does delivery work?',
        a: "Cooks manage their own delivery windows. Some use our logistics partners; others do collection only. Each cook's profile shows their delivery options clearly before you order.",
      },
      {
        q: 'What if my order is wrong or late?',
        a: 'Open the app and tap "Get help" on your order. If the cook cannot resolve it within the hour, you receive a full refund — no forms, no waiting.',
      },
    ],
  },
  {
    label: 'Payments',
    items: [
      {
        q: 'What payment methods are accepted?',
        a: "Card, bank transfer, USSD, and mobile wallets — all via Flutterwave's secure gateway. Your payment details are never stored on our servers.",
      },
      {
        q: 'How do I get a refund?',
        a: 'If your order is late or incorrect and the cook cannot resolve it within an hour, a full refund is issued automatically to your original payment method within 24 hours.',
      },
      {
        q: 'Is my payment information secure?',
        a: "All payments are processed through Flutterwave's PCI DSS-compliant gateway. FOODSbyme never stores card details on our servers.",
      },
    ],
  },
  {
    label: 'For cooks & chefs',
    items: [
      {
        q: 'How do I apply to join as a cook?',
        a: 'Apply through the app or email hello@foodsbyme.com. We review your application, schedule a kitchen visit, and help you set up your profile. The process takes 5–10 business days.',
      },
      {
        q: 'Do I get my own URL and storefront?',
        a: 'Yes. Every cook gets a unique profile URL — foodsbyme.com/@yourname — that you can share anywhere. Customers can browse your full menu, follow you, and order directly through your page.',
      },
      {
        q: 'Can I import my social media following?',
        a: 'Yes. Connect your Instagram or TikTok during onboarding. Your existing followers are notified that you are on FOODSbyme and can follow you on the platform automatically.',
      },
      {
        q: 'How and when do I get paid?',
        a: 'Payments are released to your bank account within 24 hours of a completed order. You can track all payouts in the Earnings section of the app.',
      },
      {
        q: 'What does FOODSbyme charge cooks?',
        a: 'We charge a small platform fee per order, with no upfront costs and no monthly subscription. Full fee details are shared during your onboarding session.',
      },
    ],
  },
  {
    label: 'Private chef bookings',
    items: [
      {
        q: 'How do I book a private chef?',
        a: 'Browse verified private chefs, check their event availability, and book directly through the app. Chefs are available for home dinners, birthdays, corporate events, and weddings.',
      },
      {
        q: 'How far in advance should I book?',
        a: 'We recommend booking at least 5 days in advance for events. Popular chefs have their calendars booked weeks ahead — early booking is advisable.',
      },
      {
        q: 'What happens if a chef cancels my booking?',
        a: 'If a chef cancels, you are fully refunded within 24 hours and our team helps you find a suitable alternative chef for your event at no extra cost.',
      },
    ],
  },
];

export default function SupportContent() {
  return (
    <>
      {/* Hero */}
      <div className="bg-ink pt-28 pb-14 px-6 md:px-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-4">Help Centre</p>
          <h1 className="font-serif text-[clamp(2rem,4.5vw,3.5rem)] text-cream leading-[1.05] tracking-tight mb-4">
            How can we help?
          </h1>
          <p className="text-cream/50 text-base font-light leading-relaxed max-w-md">
            Find answers to common questions or reach our team directly.
          </p>
        </div>
      </div>

      {/* Contact strip */}
      <div className="bg-charcoal py-6 px-6 md:px-10 border-b border-cream/5">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-y-4 gap-x-10 md:gap-x-14">
          <ContactItem
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            }
            label="Address"
            value="42, Oba Yekini Elegushi Rd, Lagos"
          />
          <ContactItem
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.26h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            }
            label="Phone"
            value="+234 807 235 0602"
            href="tel:+2348072350602"
          />
          <ContactItem
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            }
            label="Support"
            value="support@foodsbyme.com"
            href="mailto:support@foodsbyme.com"
          />
          <ContactItem
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            }
            label="General enquiries"
            value="hello@foodsbyme.com"
            href="mailto:hello@foodsbyme.com"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="bg-parchment py-14 md:py-20 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-serif text-[1.5rem] text-ink tracking-tight mb-8">Browse by topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div key={cat.title} className="bg-cream border border-border/50 rounded-2xl p-5 hover:shadow-warm transition-all duration-300 cursor-pointer group">
                <span className="text-spice mb-3 block">{cat.icon}</span>
                <h3 className="font-serif text-base text-ink font-medium mb-1 group-hover:text-spice transition-colors">{cat.title}</h3>
                <p className="text-stone text-sm font-light leading-relaxed">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ by topic */}
      <div className="bg-cream py-14 md:py-20 px-6 md:px-10">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-[1.5rem] text-ink tracking-tight mb-10">Frequently asked</h2>
          <div className="space-y-10">
            {topics.map((topic) => (
              <div key={topic.label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-spice mb-3">{topic.label}</p>
                <div className="space-y-[1px] rounded-2xl overflow-hidden border border-border/60">
                  {topic.items.map((item, i) => (
                    <AccordionItem key={i} question={item.q} answer={item.a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact CTA */}
      <div className="bg-parchment py-14 md:py-20 px-6 md:px-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-[1.8rem] text-ink tracking-tight mb-3">Still need help?</h2>
          <p className="text-stone text-sm font-light mb-8 leading-relaxed">
            Our support team is available Monday–Friday, 9am–6pm WAT.<br />
            We typically respond within 2 hours.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="mailto:support@foodsbyme.com"
              className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-cream text-sm font-medium rounded-full hover:bg-charcoal transition-colors"
            >
              Email support
            </a>
            <a
              href="tel:+2348072350602"
              className="inline-flex items-center gap-2 px-6 py-3 border border-border text-ink text-sm font-medium rounded-full hover:bg-warm/50 transition-colors"
            >
              Call us
            </a>
          </div>
          <p className="text-muted text-xs mt-6 font-light">
            42, Oba Yekini Elegushi Rd, Lagos &middot; +234 807 235 0602
          </p>
        </div>
      </div>
    </>
  );
}

function ContactItem({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-start gap-2.5">
      <span className="text-cream/40 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-cream/30 mb-0.5">{label}</p>
        <p className="text-cream/70 text-[13px] font-light">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="hover:text-cream/90 transition-colors">
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-cream">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left group"
      >
        <span className="font-serif text-[15px] text-ink font-medium leading-snug group-hover:text-spice transition-colors duration-200">
          {question}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted group-hover:text-spice transition-colors"
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-4 text-stone text-sm leading-relaxed font-light border-t border-border/40 pt-3">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
