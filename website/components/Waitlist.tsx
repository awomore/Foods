'use client';

import { useState, FormEvent } from 'react';
import { CheckCircle } from 'lucide-react';

export default function Waitlist() {
  const [type, setType] = useState<'customer' | 'cook'>('customer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Store locally for now — swap with API call when ready
    await new Promise(r => setTimeout(r, 800));
    setDone(true);
    setLoading(false);
  }

  return (
    <section id="waitlist" className="py-24 bg-cream">
      <div className="max-w-xl mx-auto px-5 text-center">
        <p className="text-spice text-sm font-semibold uppercase tracking-widest mb-3">Early access</p>
        <h2 className="font-serif text-4xl md:text-5xl text-ink mb-4">
          Be the first to know
        </h2>
        <p className="text-stone leading-relaxed mb-10">
          FOODSbyme is launching soon in Lagos. Join the waitlist to get early access and a free first delivery.
        </p>

        {done ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-8 flex flex-col items-center gap-3">
            <CheckCircle size={40} className="text-green-500" />
            <h3 className="font-semibold text-ink text-lg">You&apos;re on the list!</h3>
            <p className="text-stone text-sm">We&apos;ll reach out as soon as we launch in your area.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-warm p-6 md:p-8 text-left space-y-4 shadow-sm">
            {/* Type toggle */}
            <div className="flex rounded-xl overflow-hidden border border-warm">
              {(['customer', 'cook'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 text-sm font-semibold transition-colors capitalize ${
                    type === t ? 'bg-spice text-white' : 'bg-white text-stone hover:bg-warm'
                  }`}
                >
                  I want to {t === 'customer' ? 'order food' : 'cook & earn'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 border border-warm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-spice/20 focus:border-spice bg-cream"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Phone number (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                className="w-full px-3 py-2.5 border border-warm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-spice/20 focus:border-spice bg-cream"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-spice text-white font-semibold rounded-xl hover:bg-ember transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? 'Joining…' : type === 'customer' ? 'Join the waitlist' : 'Apply as a cook'}
            </button>

            <p className="text-xs text-stone text-center">No spam. We&apos;ll only email you when we launch.</p>
          </form>
        )}
      </div>
    </section>
  );
}
