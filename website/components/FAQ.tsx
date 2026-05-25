'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeUp } from './ui/FadeUp';

const faqs = [
  {
    category: 'Getting started',
    items: [
      {
        q: 'How do I get started as a customer?',
        a: 'Download the FOODSbyme app, create your account with your phone number, and start browsing cooks in your area. Your first order can be placed in under two minutes.',
      },
      {
        q: 'What cities is FOODSbyme available in?',
        a: 'We are currently available across Lagos — from Lekki to Ikeja, Surulere to Victoria Island. We are actively expanding to Abuja and Port Harcourt in 2025.',
      },
      {
        q: 'Is there a minimum order value?',
        a: 'No minimum order. Order a single meal or a feast for ten — the platform works the same way.',
      },
    ],
  },
  {
    category: 'Becoming a cook',
    items: [
      {
        q: 'How do I become a cook on FOODSbyme?',
        a: 'Apply through the app or website. Our team will review your application, schedule a kitchen visit, and help you set up your cook profile. The process takes between 5 and 10 business days.',
      },
      {
        q: 'How are cooks verified?',
        a: 'Every cook goes through identity verification, a kitchen inspection, and a food safety assessment. We also interview cooks to understand their story and culinary background before approving their profile.',
      },
      {
        q: 'What does FOODSbyme charge cooks?',
        a: 'We take a fair platform fee per transaction. There are no monthly fees, no setup costs, and no hidden charges. Cooks keep the majority of every order they fulfill.',
      },
    ],
  },
  {
    category: 'Orders & delivery',
    items: [
      {
        q: 'How does delivery work?',
        a: 'Cooks manage their own delivery schedules. Some use our logistics partners; others prefer collection only. You will see each cook\'s delivery options clearly on their profile before ordering.',
      },
      {
        q: 'Can I schedule a meal in advance?',
        a: 'Yes. Many cooks on the platform accept pre-orders for specific days and times. You can schedule up to a week in advance depending on the cook\'s availability settings.',
      },
      {
        q: 'What if my order is late or wrong?',
        a: 'Contact us through the app within the hour. If the cook cannot resolve it, you receive a full refund. No paperwork, no waiting periods.',
      },
    ],
  },
  {
    category: 'Payments & gifting',
    items: [
      {
        q: 'What payment methods are accepted?',
        a: 'We accept all major debit and credit cards, bank transfer, USSD, and mobile wallets through Flutterwave\'s secure payment gateway. Your payment details are never stored on our servers.',
      },
      {
        q: 'How does meal gifting work?',
        a: 'From any cook\'s profile, tap "Send as a gift." Enter the recipient\'s name and contact, write a personal note, choose a delivery time, and pay. The recipient is notified and coordinates delivery directly.',
      },
    ],
  },
  {
    category: 'Dietary & health',
    items: [
      {
        q: 'Can I filter for dietary restrictions?',
        a: 'Yes. You can filter by category including vegetarian, vegan, gluten-free, halal, and allergen-aware. Cooks also list ingredients clearly on every dish to help you make informed choices.',
      },
      {
        q: 'Are there verified health-conscious kitchens?',
        a: 'Yes. Our "Wellness Kitchen" badge identifies cooks who specialise in low-sodium, diabetic-friendly, weight-conscious, or high-protein cooking. These cooks have undergone additional nutritional disclosure verification.',
      },
    ],
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32 bg-warm/30">
      <div className="max-w-4xl mx-auto px-6 md:px-10">
        {/* Header */}
        <FadeUp className="mb-14 md:mb-18 text-center">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-4">Frequently asked</p>
          <h2 className="font-serif text-[clamp(2rem,4vw,3.2rem)] text-ink leading-[1.1] tracking-tight">
            Questions, answered.
          </h2>
        </FadeUp>

        {/* FAQ groups */}
        <div className="space-y-10">
          {faqs.map((group, gi) => (
            <FadeUp key={group.category} delay={gi * 0.05}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted mb-4">
                  {group.category}
                </p>
                <div className="space-y-[1px] rounded-2xl overflow-hidden border border-border/60">
                  {group.items.map((item, ii) => (
                    <AccordionItem key={ii} question={item.q} answer={item.a} />
                  ))}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>

        {/* Support note */}
        <FadeUp delay={0.2} className="mt-14 text-center">
          <p className="text-stone text-sm font-light">
            Still have questions?{' '}
            <a
              href="mailto:support@foodsbyme.com"
              className="text-ink font-medium underline underline-offset-4 decoration-border hover:decoration-stone transition-colors"
            >
              support@foodsbyme.com
            </a>
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-cream">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left group"
        aria-expanded={open}
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
            <line x1="7" y1="1" x2="7" y2="13" />
            <line x1="1" y1="7" x2="13" y2="7" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-stone text-sm leading-relaxed font-light border-t border-border/40 pt-3">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
