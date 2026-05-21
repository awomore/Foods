'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-cream/80 backdrop-blur-md border-b border-warm">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <a href="/" className="font-serif text-xl text-spice font-bold tracking-tight">
          FOODSbyme
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone">
          <a href="#how-it-works" className="hover:text-ink transition-colors">How it works</a>
          <a href="#for-cooks" className="hover:text-ink transition-colors">For cooks</a>
          <a href="#features" className="hover:text-ink transition-colors">Features</a>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="#waitlist"
            className="px-4 py-2 text-sm font-semibold bg-spice text-white rounded-full hover:bg-ember transition-colors"
          >
            Join waitlist
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-cream border-t border-warm px-5 py-4 space-y-4 text-sm font-medium">
          <a href="#how-it-works" onClick={() => setOpen(false)} className="block text-stone hover:text-ink">How it works</a>
          <a href="#for-cooks" onClick={() => setOpen(false)} className="block text-stone hover:text-ink">For cooks</a>
          <a href="#features" onClick={() => setOpen(false)} className="block text-stone hover:text-ink">Features</a>
          <a href="#waitlist" onClick={() => setOpen(false)} className="block w-fit px-5 py-2.5 bg-spice text-white rounded-full font-semibold">
            Join waitlist
          </a>
        </div>
      )}
    </header>
  );
}
