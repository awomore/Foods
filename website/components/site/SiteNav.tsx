'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { PRIMARY_NAV, SITE } from '@/lib/site';

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * @param overlay  When true the nav starts transparent over a dark hero and
 *                 turns solid on scroll. Use on pages with a dark hero.
 */
export default function SiteNav({ overlay = false }: { overlay?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const dark = overlay && !scrolled;
  const solidBar = scrolled || !overlay;

  const logoClass = dark ? 'text-cream' : 'text-ink';
  const linkClass = dark ? 'text-cream/80 hover:text-cream' : 'text-stone hover:text-ink';
  const ctaClass = dark
    ? 'bg-cream/15 text-cream border border-cream/30 hover:bg-cream/25 backdrop-blur-sm'
    : 'bg-ink text-cream hover:bg-charcoal';
  const barColor = dark ? 'bg-cream' : 'bg-ink';

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          solidBar ? 'bg-parchment/95 backdrop-blur-md border-b border-border/60 shadow-warm-sm' : 'bg-transparent'
        }`}
        onMouseLeave={() => setOpenGroup(null)}
      >
        <div className="container-x h-[72px] flex items-center justify-between">
          <Link
            href="/"
            className={`font-serif text-xl tracking-tight font-semibold flex-shrink-0 transition-colors duration-300 ${logoClass}`}
          >
            FOODSbyme
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {PRIMARY_NAV.map((group) => {
              if (!group.links) {
                return (
                  <Link
                    key={group.label}
                    href={group.href!}
                    className={`px-3.5 py-2 text-[13px] font-medium tracking-wide rounded-full transition-colors duration-300 ${linkClass}`}
                  >
                    {group.label}
                  </Link>
                );
              }
              const isOpen = openGroup === group.label;
              return (
                <div key={group.label} className="relative" onMouseEnter={() => setOpenGroup(group.label)}>
                  <button
                    className={`px-3.5 py-2 text-[13px] font-medium tracking-wide rounded-full inline-flex items-center gap-1 transition-colors duration-300 ${linkClass}`}
                    aria-expanded={isOpen}
                  >
                    {group.label}
                    <ChevronDown size={13} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.22, ease }}
                        className="absolute top-full left-0 pt-3 w-[330px]"
                      >
                        <div className="card p-2.5 shadow-warm-lg">
                          {group.links.map((link) => (
                            <Link
                              key={link.label}
                              href={link.href}
                              className="block px-3.5 py-3 rounded-2xl hover:bg-warm/50 transition-colors group/item"
                            >
                              <span className="block text-[13.5px] font-medium text-ink group-hover/item:text-spice transition-colors">
                                {link.label}
                              </span>
                              {link.desc && (
                                <span className="block text-[12px] text-muted mt-0.5 font-light leading-snug">
                                  {link.desc}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <Link
              href="/fleet/apply"
              className={`px-3.5 py-2 text-[13px] font-medium rounded-full transition-colors duration-300 ${linkClass}`}
            >
              Become a partner
            </Link>
            <a
              href={SITE.app.ios}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-full transition-all duration-300 ${ctaClass}`}
            >
              Get the app
            </a>
          </div>

          <button
            className="lg:hidden flex flex-col gap-[5px] p-2 -mr-2"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <motion.span animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }} transition={{ duration: 0.25 }} className={`block w-5 h-[1.5px] origin-center ${open ? 'bg-ink' : barColor}`} />
            <motion.span animate={open ? { opacity: 0 } : { opacity: 1 }} transition={{ duration: 0.2 }} className={`block w-5 h-[1.5px] ${open ? 'bg-ink' : barColor}`} />
            <motion.span animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }} transition={{ duration: 0.25 }} className={`block w-5 h-[1.5px] origin-center ${open ? 'bg-ink' : barColor}`} />
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div className="absolute inset-0 bg-parchment" />
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease }}
              className="relative h-full overflow-y-auto pt-24 pb-12 px-7"
            >
              <nav className="space-y-1">
                {PRIMARY_NAV.map((group) => {
                  if (!group.links) {
                    return (
                      <Link
                        key={group.label}
                        href={group.href!}
                        onClick={() => setOpen(false)}
                        className="block font-serif text-2xl text-ink font-medium py-3.5 border-b border-warm/60"
                      >
                        {group.label}
                      </Link>
                    );
                  }
                  const expanded = mobileExpanded === group.label;
                  return (
                    <div key={group.label} className="border-b border-warm/60">
                      <button
                        className="w-full flex items-center justify-between font-serif text-2xl text-ink font-medium py-3.5"
                        onClick={() => setMobileExpanded(expanded ? null : group.label)}
                        aria-expanded={expanded}
                      >
                        {group.label}
                        <ChevronDown size={20} className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease }}
                            className="overflow-hidden"
                          >
                            <div className="pb-3 pl-1 space-y-1">
                              {group.links.map((link) => (
                                <Link
                                  key={link.label}
                                  href={link.href}
                                  onClick={() => setOpen(false)}
                                  className="block text-base text-stone py-2 hover:text-spice"
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </nav>
              <div className="mt-8 flex flex-col gap-3">
                <Link href="/fleet/apply" onClick={() => setOpen(false)} className="btn-ghost w-full">
                  Become a partner
                </Link>
                <a href={SITE.app.ios} className="btn-dark w-full">
                  Get the app
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
