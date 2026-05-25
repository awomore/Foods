import Image from 'next/image';
import { FadeUp } from './ui/FadeUp';

const cooks = [
  {
    name: "Mama Titi's Kitchen",
    handle: '@mamatiti',
    specialty: 'West African Home Cooking',
    tags: ['Jollof Rice', 'Egusi', 'Pepper Soup'],
    location: 'Lekki, Lagos',
    rating: '4.9',
    reviews: 238,
    meals: 1240,
    image: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3df1?auto=format&fit=crop&w=800&q=85',
    open: true,
  },
  {
    name: "Chef Adaeze",
    handle: '@chefadaeze',
    specialty: 'Modern Nigerian Fusion',
    tags: ['Suya', 'Afro-Fusion', 'Small Chops'],
    location: 'Ikeja, Lagos',
    rating: '5.0',
    reviews: 184,
    meals: 892,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=85',
    open: true,
  },
  {
    name: "Iya Bisi Foods",
    handle: '@iyabisi',
    specialty: 'Traditional Yoruba Cuisine',
    tags: ['Amala', 'Gbegiri', 'Efo Riro'],
    location: 'Surulere, Lagos',
    rating: '4.8',
    reviews: 312,
    meals: 2100,
    image: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=800&q=85',
    open: false,
  },
  {
    name: "Emeka's Smokehouse",
    handle: '@emekassmoke',
    specialty: 'Eastern Nigerian Grills',
    tags: ['Ofe Onugbu', 'Banga Soup', 'Nkwobi'],
    location: 'Victoria Island, Lagos',
    rating: '4.9',
    reviews: 97,
    meals: 445,
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=85',
    open: true,
  },
];

export default function FeaturedCooks() {
  return (
    <section id="featured-cooks" className="py-24 md:py-32 bg-parchment overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        {/* Section header */}
        <FadeUp className="mb-14 md:mb-18">
          <p className="text-spice text-[11px] font-semibold uppercase tracking-[0.22em] mb-4">The cooks</p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h2 className="font-serif text-[clamp(2rem,4vw,3.2rem)] text-ink leading-[1.1] tracking-tight max-w-sm">
              Real kitchens,<br />
              <em className="font-normal italic">real stories.</em>
            </h2>
            <p className="text-stone text-sm leading-relaxed max-w-xs font-light">
              Every cook on FOODSbyme has a brand, an identity, and a culinary voice worth discovering.
            </p>
          </div>
        </FadeUp>

        {/* Cook cards grid — horizontal scroll on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {cooks.map((cook, i) => (
            <CookCard key={cook.handle} cook={cook} index={i} />
          ))}
        </div>

        {/* Browse CTA */}
        <FadeUp delay={0.2} className="mt-12 text-center">
          <a
            href="#cta"
            className="inline-flex items-center gap-2 text-sm font-medium text-stone hover:text-ink transition-colors group"
          >
            Browse all cooks
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1" aria-hidden>
              &rarr;
            </span>
          </a>
        </FadeUp>
      </div>
    </section>
  );
}

function CookCard({ cook, index }: { cook: typeof cooks[0]; index: number }) {
  return (
    <FadeUp delay={index * 0.08} className="group cursor-pointer">
      <article className="bg-cream rounded-3xl overflow-hidden border border-border/50 hover:border-border hover:shadow-warm transition-all duration-500">
        {/* Image */}
        <div className="relative h-52 sm:h-48 lg:h-52 overflow-hidden">
          <Image
            src={cook.image}
            alt={`${cook.name} — ${cook.specialty}`}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                cook.open
                  ? 'bg-cream/95 text-ink'
                  : 'bg-ink/70 text-cream/80'
              }`}
            >
              {cook.open ? 'Open now' : 'Pre-order'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-serif text-base text-ink font-medium leading-tight">{cook.name}</h3>
            <span className="text-[11px] text-stone font-medium flex-shrink-0">{cook.rating} ★</span>
          </div>
          <p className="text-[11px] text-muted mb-3 tracking-wide">{cook.specialty}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {cook.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium text-stone bg-warm/60 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Meta row */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <p className="text-[10px] text-muted">{cook.location}</p>
            <p className="text-[10px] text-muted">{cook.reviews} reviews</p>
          </div>
        </div>
      </article>
    </FadeUp>
  );
}
