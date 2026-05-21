'use client';

import { useState, useEffect } from 'react';
import { StoreBadge } from './StoreBadge';
import { Menu, X } from 'lucide-react';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-parchment/95 backdrop-blur-sm shadow-sm shadow-ink/5' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-18 flex items-center justify-between py-4">
        <a href="/" className="font-serif text-2xl text-ink font-semibold tracking-tight">
          FOODSbyme
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone">
          <a href="#features" className="hover:text-ink transition-colors">Features</a>
          <a href="#for-cooks" className="hover:text-ink transition-colors">For cooks</a>
          <a href="#download" className="hover:text-ink transition-colors">Download</a>
        </nav>

        <div className="hidden md:block">
          <a
            href="#download"
            className="px-5 py-2.5 bg-ink text-white text-sm font-medium rounded-full hover:bg-stone transition-colors"
          >
            Get the app
          </a>
        </div>

        <button className="md:hidden p-2 -mr-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-parchment border-t border-warm px-6 py-5 space-y-5">
          <a href="#features" onClick={() => setOpen(false)} className="block text-sm font-medium text-stone hover:text-ink">Features</a>
          <a href="#for-cooks" onClick={() => setOpen(false)} className="block text-sm font-medium text-stone hover:text-ink">For cooks</a>
          <a href="#download" onClick={() => setOpen(false)} className="block text-sm font-medium text-stone hover:text-ink">Download</a>
          <div className="flex flex-col gap-3 pt-2">
            <StoreBadge store="apple" variant="dark" />
            <StoreBadge store="google" variant="dark" />
          </div>
        </div>
      )}
    </header>
  );
}
