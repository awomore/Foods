import Image from 'next/image';
import { StoreBadge } from './StoreBadge';

const POINTS = [
  { label: 'Keep 96.25% of every order', sub: 'We take a flat 3.75% — one of the lowest platform fees anywhere.' },
  { label: 'Cook when you want', sub: 'Go live on your schedule. No shifts, no minimum hours, no penalties.' },
  { label: 'Build a loyal following', sub: 'Customers follow cooks they love and order again and again.' },
  { label: 'We handle the rest', sub: 'Payments, rider coordination, and customer support are all on us.' },
];

export default function ForCooks() {
  return (
    <section id="for-cooks" className="relative overflow-hidden bg-ink">

      {/* Background photo */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1607631568010-a87245c0daf8?auto=format&fit=crop&w=1600&q=80"
          alt="Home cook preparing a meal"
          fill
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 md:px-10 py-28 grid md:grid-cols-2 gap-16 items-center">

        {/* Left content */}
        <div>
          <p className="text-spice text-xs font-semibold uppercase tracking-[0.2em] mb-6">For cooks</p>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-[1.1] mb-6">
            Turn what you love<br />
            <span className="italic font-normal">into a living.</span>
          </h2>
          <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
            You already cook every day. FOODSbyme gives you the platform, the customers, and the infrastructure to earn from it — on your own terms.
          </p>

          <div className="flex flex-wrap gap-3">
            <StoreBadge store="apple" variant="outline" />
            <StoreBadge store="google" variant="outline" />
          </div>
        </div>

        {/* Right: points list */}
        <div className="space-y-0 border-t border-white/10">
          {POINTS.map(({ label, sub }, i) => (
            <div key={label} className="py-6 border-b border-white/10">
              <div className="flex items-start gap-4">
                <span className="text-xs font-semibold text-spice mt-0.5 w-5 flex-shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="font-semibold text-white">{label}</p>
                  <p className="text-white/50 text-sm mt-1 leading-relaxed">{sub}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
