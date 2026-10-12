'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Package, CreditCard, ChefHat, CalendarDays, Shield, Mail, MessageSquare } from 'lucide-react';
import type { Dict } from '@/lib/i18n/dict';
import { SITE } from '@/lib/site';

const CATEGORY_ICONS = [Home, Package, CreditCard, ChefHat, CalendarDays, Shield];

export default function SupportContent({ t }: { t: Dict['support'] }) {
  return (
    <>
      {/* Hero */}
      <div className="bg-ink pt-[120px] pb-14">
        <div className="container-x">
          <p className="kicker kicker-dot mb-4">{t.kicker}</p>
          <h1 className="font-serif font-bold text-[clamp(2.2rem,4.8vw,3.8rem)] text-cream leading-[1.05] tracking-[-0.03em] mb-4">{t.title}</h1>
          <p className="text-cream/65 text-base leading-relaxed max-w-md">{t.intro}</p>
        </div>
      </div>

      {/* Contact strip */}
      <div className="bg-charcoal py-6 border-b border-cream/5">
        <div className="container-x flex flex-wrap gap-y-4 gap-x-10 md:gap-x-14">
          <ContactItem icon={<Mail size={15} />} label={t.supportEmail} value={SITE.email.support} href={`mailto:${SITE.email.support}`} />
          <ContactItem icon={<Mail size={15} />} label={t.generalEmail} value={SITE.email.hello} href={`mailto:${SITE.email.hello}`} />
          <ContactItem icon={<MessageSquare size={15} />} label={t.inApp} value={t.inAppValue} />
        </div>
      </div>

      {/* Categories */}
      <div className="bg-parchment py-14 md:py-20">
        <div className="container-x">
          <h2 className="font-serif font-bold text-[1.6rem] text-ink tracking-tight mb-8">{t.browse}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.categories.map((cat, i) => {
              const Icon = CATEGORY_ICONS[i];
              return (
                <div key={cat.title} className="bg-cream border border-border rounded-2xl p-5">
                  <Icon size={20} className="text-spice mb-3" strokeWidth={1.6} />
                  <h3 className="font-serif text-base text-ink mb-1">{cat.title}</h3>
                  <p className="text-stone text-sm leading-relaxed">{cat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FAQ by topic */}
      <div className="bg-cream py-14 md:py-20">
        <div className="container-x max-w-3xl">
          <h2 className="font-serif font-bold text-[1.6rem] text-ink tracking-tight mb-10">{t.faqTitle}</h2>
          <div className="space-y-10">
            {t.topics.map((topic) => (
              <div key={topic.label}>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-spice mb-3">{topic.label}</p>
                <div className="space-y-[1px] rounded-2xl overflow-hidden border border-border">
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
      <div className="bg-parchment py-14 md:py-20">
        <div className="container-x max-w-3xl text-center">
          <h2 className="font-serif font-bold text-[1.9rem] text-ink tracking-tight mb-3">{t.stillTitle}</h2>
          <p className="text-stone text-sm mb-8 leading-relaxed max-w-md mx-auto">{t.stillBody}</p>
          <a href={`mailto:${SITE.email.support}`} className="btn-dark">{t.emailCta}</a>
        </div>
      </div>
    </>
  );
}

function ContactItem({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-start gap-2.5">
      <span className="text-cream/45 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-cream/45 mb-0.5">{label}</p>
        <p className="text-cream/80 text-[13.5px]">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href} className="hover:opacity-90 transition-opacity">{inner}</a> : <div>{inner}</div>;
}

function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-parchment">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 px-6 py-4 text-start group">
        <span className="font-serif text-[15.5px] text-ink font-semibold leading-snug group-hover:text-spice transition-colors duration-200">{question}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted group-hover:text-spice transition-colors"
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="7" y1="1" x2="7" y2="13" /><line x1="1" y1="7" x2="13" y2="7" />
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
            <p className="px-6 pb-4 text-stone text-sm leading-relaxed border-t border-border pt-3">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
