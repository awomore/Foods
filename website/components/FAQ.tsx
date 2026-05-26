'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeUp } from './ui/FadeUp';

const faqs = [
  {
    q: 'How do I get started as a customer?',
    a: 'Download the app, create an account with your phone number, and start browsing cooks near you. Your first order takes under two minutes.',
  },
  {
    q: 'How do I become a cook on FOODSbyme?',
    a: 'Apply through the app or email hello@foodsbyme.com. We review your application, schedule a kitchen visit, and help you set up your profile. The process takes 5–10 business days.',
  },
  {
    q: 'Can I hire a private chef for an event?',
    a: 'Yes. Browse our verified private chefs, check their event availability, and book directly through the app. Chefs are available for home dinners, birthdays, corporate events, and weddings.',
  },
  {
    q: 'How are cooks verified?',
    a: 'Every cook goes through identity verification, a kitchen inspection, and a food safety assessment. Private chefs undergo additional vetting and certification checks.',
  },
  {
    q: 'How does delivery work?',
    a: 'Cooks manage their own delivery windows. Some use our logistics partners; others do collection only. Delivery options are shown clearly on each cook\'s profile before you order.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'Card, bank transfer, USSD, and mobile wallets — all via Flutterwave\'s secure gateway. Your payment details are never stored on our servers.',
  },
  {
    q: 'What if my order is late or wrong?',
    a: 'Contact us through the app. If the cook cannot resolve it within the hour, you receive a full refund — no forms, no waiting.',
  },
  {
    q: 'Is there a support page?',
    a: 'Yes. Visit foodsbyme.com/support for our full help centre, or email support@foodsbyme.com directly.',
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-16 md:py-24 bg-parchment">
      <div className="max-w-3xl mx-auto px-6 md:px-10">
        <FadeUp className="mb-10 text-center">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">Frequently asked</p>
          <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.8rem)] text-ink leading-[1.1] tracking-tight">
            Questions, answered.
          </h2>
        </FadeUp>

        <div className="space-y-[1px] rounded-2xl overflow-hidden border border-border/60">
          {faqs.map((item, i) => (
            <AccordionItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>

        <FadeUp delay={0.15} className="mt-10 text-center">
          <p className="text-stone text-sm font-light">
            Still have questions?{' '}
            <a href="/support" className="text-ink font-medium underline underline-offset-4 decoration-border hover:decoration-stone transition-colors">
              Visit our support centre
            </a>
            {' '}or email{' '}
            <a href="mailto:support@foodsbyme.com" className="text-ink font-medium underline underline-offset-4 decoration-border hover:decoration-stone transition-colors">
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
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left group">
        <span className="font-serif text-[15px] text-ink font-medium leading-snug group-hover:text-spice transition-colors duration-200">
          {question}
        </span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted group-hover:text-spice transition-colors" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden">
            <p className="px-6 pb-4 text-stone text-sm leading-relaxed font-light border-t border-border/40 pt-3">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
