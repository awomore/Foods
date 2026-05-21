import { ShieldCheck, MapPin, Star, CreditCard, Clock, Leaf } from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Verified cooks',
    body: 'Every cook completes ID verification and food safety certification before their first order. You always know exactly who is preparing your food.',
  },
  {
    icon: MapPin,
    title: 'Hyper-local',
    body: 'We show you cooks within your immediate neighbourhood — not just your city. Shorter distance means fresher food on your table.',
  },
  {
    icon: Leaf,
    title: 'Allergen profiles',
    body: 'Set your allergens once. Cooks are automatically warned when your profile conflicts with their ingredients, before you even place an order.',
  },
  {
    icon: Clock,
    title: 'Real-time tracking',
    body: "Follow your order from the moment the cook starts preparing through pickup and delivery. No more guessing where your food is.",
  },
  {
    icon: Star,
    title: 'Honest reviews',
    body: 'Only verified buyers can leave a review. Ratings reflect what real customers actually experienced — not incentivised feedback.',
  },
  {
    icon: CreditCard,
    title: 'Secure payments',
    body: 'Every transaction is held in escrow until your order is confirmed delivered. Pay with card, bank transfer, or USSD.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-parchment">
      <div className="max-w-7xl mx-auto px-6 md:px-10">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <p className="text-spice text-xs font-semibold uppercase tracking-[0.2em] mb-5">Built different</p>
          <h2 className="font-serif text-4xl md:text-5xl text-ink leading-tight">
            Designed for people who<br />
            <span className="italic font-normal">care about what they eat</span>
          </h2>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-warm rounded-2xl overflow-hidden">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-parchment p-8 hover:bg-white transition-colors duration-200 group"
            >
              <div className="w-10 h-10 rounded-xl bg-warm flex items-center justify-center mb-5 group-hover:bg-spice/10 transition-colors">
                <Icon size={18} className="text-spice" strokeWidth={1.5} />
              </div>
              <h3 className="font-semibold text-ink mb-2">{title}</h3>
              <p className="text-stone text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
