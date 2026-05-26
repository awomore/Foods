import Image from 'next/image';
import { FadeUp } from './ui/FadeUp';

const cooks = [
  {
    name: "Mama Titi's Kitchen",
    handle: '@mamatiti',
    specialty: 'West African Home Cooking',
    tags: ['Jollof Rice', 'Egusi Soup', 'Pepper Soup'],
    location: 'Lekki, Lagos',
    rating: '4.9',
    reviews: 238,
    followers: '1.4k',
    image: 'https://images.unsplash.com/photo-1607631568010-a87245c0daf8?auto=format&fit=crop&w=800&q=85',
    open: true,
    type: 'home',
  },
  {
    name: "Chef Adaeze",
    handle: '@chefadaeze',
    specialty: 'Modern Nigerian Fusion',
    tags: ['Suya', 'Afro-Fusion', 'Small Chops'],
    location: 'Ikeja, Lagos',
    rating: '5.0',
    reviews: 184,
    followers: '3.2k',
    image: 'https://images.unsplash.com/photo-1583394293214-bd92b4cff1f4?auto=format&fit=crop&w=800&q=85',
    open: true,
    type: 'chef',
  },
  {
    name: "Iya Bisi Foods",
    handle: '@iyabisifoods',
    specialty: 'Traditional Yoruba Cuisine',
    tags: ['Amala', 'Gbegiri', 'Efo Riro'],
    location: 'Surulere, Lagos',
    rating: '4.8',
    reviews: 312,
    followers: '2.1k',
    image: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?auto=format&fit=crop&w=800&q=85',
    open: false,
    type: 'home',
  },
  {
    name: "Chef Emeka",
    handle: '@chefemeka',
    specialty: 'Private Dining & Events',
    tags: ['Nkwobi', 'Banga Soup', 'Ofe Onugbu'],
    location: 'Victoria Island, Lagos',
    rating: '4.9',
    reviews: 97,
    followers: '892',
    image: 'https://images.unsplash.com/photo-1528712306091-ed0763094c98?auto=format&fit=crop&w=800&q=85',
    open: true,
    type: 'chef',
  },
];

export default function FeaturedCooks() {
  return (
    <section id="featured-cooks" className="py-16 md:py-24 bg-parchment overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <FadeUp className="mb-10 md:mb-12">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">The cooks</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <h2 className="font-serif text-[clamp(1.8rem,3.5vw,2.8rem)] text-ink leading-[1.1] tracking-tight max-w-xs">
              Real kitchens,<br />
              <em className="font-normal italic">real stories.</em>
            </h2>
            <p className="text-stone text-sm leading-relaxed max-w-xs font-light">
              Follow your favourite cooks, order meals, or book a private chef for your next event.
            </p>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cooks.map((cook, i) => (
            <CookCard key={cook.name} cook={cook} index={i} />
          ))}
        </div>

        <FadeUp delay={0.2} className="mt-10 text-center">
          <a href="#cta" className="inline-flex items-center gap-2 text-sm font-medium text-stone hover:text-ink transition-colors group">
            Browse all cooks
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
          </a>
        </FadeUp>
      </div>
    </section>
  );
}

function CookCard({ cook, index }: { cook: typeof cooks[0]; index: number }) {
  return (
    <FadeUp delay={index * 0.08} className="group cursor-pointer">
      <article className="bg-cream rounded-3xl overflow-hidden border border-border/50 hover:shadow-warm transition-all duration-500">
        <div className="relative h-52 overflow-hidden">
          <Image
            src={cook.image}
            alt={`${cook.name} — ${cook.specialty}`}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          <div className="absolute top-3 left-3">
            <span className={`text-[9px] font-semibold px-2 py-1 rounded-full uppercase tracking-wide ${
              cook.type === 'chef' ? 'bg-ink/80 text-cream' : 'bg-cream/90 text-ink'
            }`}>
              {cook.type === 'chef' ? 'Private Chef' : 'Home Cook'}
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <span className={`text-[9px] font-semibold px-2 py-1 rounded-full ${
              cook.open ? 'bg-cream/95 text-ink' : 'bg-ink/60 text-cream/80'
            }`}>
              {cook.open ? 'Open now' : 'Pre-order'}
            </span>
          </div>
          {/* Gradient overlay for bottom text */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/60 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <p className="text-[10px] text-cream/90 font-medium">{cook.followers} followers</p>
            <p className="text-[10px] text-cream/90 font-medium">{cook.rating} ★</p>
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-serif text-base text-ink font-medium leading-tight mb-0">{cook.name}</h3>
          <p className="text-[10px] text-spice/70 font-medium mb-0.5">{cook.handle}</p>
          <p className="text-[11px] text-muted mb-3">{cook.specialty}</p>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {cook.tags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-stone bg-warm/60 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex gap-2 pt-3 border-t border-border/60">
            <button className="flex-1 py-2 bg-ink text-cream text-[11px] font-semibold rounded-xl hover:bg-charcoal transition-colors">
              Order
            </button>
            <button className="flex-1 py-2 border border-border text-ink text-[11px] font-semibold rounded-xl hover:bg-warm/40 transition-colors">
              {cook.type === 'chef' ? 'Book Chef' : 'Follow'}
            </button>
          </div>
        </div>
      </article>
    </FadeUp>
  );
}
