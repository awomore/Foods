'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { label: 'Discover', href: '#featured-cooks' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For cooks', href: '#why-exists' },
  { label: 'FAQ', href: '#faq' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const logoClass   = scrolled ? 'text-ink'      : 'text-cream';
  const linkClass   = scrolled ? 'text-stone hover:text-ink' : 'text-cream/80 hover:text-cream';
  const ctaClass    = scrolled
    ? 'bg-ink text-cream hover:bg-charcoal'
    : 'bg-cream/15 text-cream border border-cream/30 hover:bg-cream/25 backdrop-blur-sm';
  const barClass    = scrolled ? 'bg-ink' : 'bg-cream';

  return (
    <>
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-parchment/96 backdrop-blur-md border-b border-border/60 shadow-warm-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 md:px-10 h-[72px] flex items-center justify-between">
          <a href="/" className={`font-serif text-xl tracking-tight font-semibold flex-shrink-0 transition-colors duration-300 ${logoClass}`}>
            FOODSbyme
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                className={`text-[13px] font-medium transition-colors duration-300 tracking-wide ${linkClass}`}>
                {link.label}
              </a>
            ))}
          </nav>

          <a href="#cta"
            className={`hidden md:inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-full transition-all duration-300 flex-shrink-0 ${ctaClass}`}>
            Get the app
          </a>

          <button className="md:hidden flex flex-col gap-[5px] p-2 -mr-2"
            onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'}>
            <motion.span animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.25 }} className={`block w-5 h-[1.5px] origin-center transition-colors duration-300 ${barClass}`} />
            <motion.span animate={open ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.2 }} className={`block w-5 h-[1.5px] transition-colors duration-300 ${barClass}`} />
            <motion.span animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.25 }} className={`block w-5 h-[1.5px] origin-center transition-colors duration-300 ${barClass}`} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }} className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-parchment/98 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col justify-center h-full px-8 pt-20 pb-12">
              <nav className="space-y-1">
                {navLinks.map((link, i) => (
                  <motion.a key={link.label} href={link.href} onClick={() => setOpen(false)}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="block font-serif text-3xl text-ink font-medium py-3 border-b border-warm/60 hover:text-spice transition-colors">
                    {link.label}
                  </motion.a>
                ))}
              </nav>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="mt-10">
                <a href="#cta" onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 px-7 py-4 bg-ink text-cream text-sm font-medium rounded-full">
                  Get the app
                </a>
              </motion.div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}
                className="mt-auto text-xs text-muted tracking-wide">
                Join someone&apos;s table.
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
