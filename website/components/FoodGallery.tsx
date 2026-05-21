import Image from 'next/image';

const PHOTOS = [
  {
    src: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    alt: 'Freshly prepared home meal',
    span: 'row-span-2',
  },
  {
    src: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=80',
    alt: 'Home-cooked dish close-up',
    span: '',
  },
  {
    src: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80',
    alt: 'Plated meal with fresh ingredients',
    span: '',
  },
];

export default function FoodGallery() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">

          {/* Photo grid */}
          <div className="grid grid-cols-2 grid-rows-2 gap-3 h-[480px]">
            <div className="row-span-2 relative rounded-2xl overflow-hidden">
              <Image src={PHOTOS[0].src} alt={PHOTOS[0].alt} fill className="object-cover" />
            </div>
            <div className="relative rounded-2xl overflow-hidden">
              <Image src={PHOTOS[1].src} alt={PHOTOS[1].alt} fill className="object-cover" />
            </div>
            <div className="relative rounded-2xl overflow-hidden">
              <Image src={PHOTOS[2].src} alt={PHOTOS[2].alt} fill className="object-cover" />
            </div>
          </div>

          {/* Copy */}
          <div className="md:pt-12">
            <p className="text-spice text-xs font-semibold uppercase tracking-[0.2em] mb-5">The food</p>
            <h2 className="font-serif text-4xl md:text-5xl text-ink leading-tight mb-6">
              Not a restaurant.<br />
              <span className="italic font-normal">Something better.</span>
            </h2>
            <p className="text-stone leading-relaxed mb-6 max-w-md">
              Restaurant kitchens optimise for speed and consistency. Home cooks optimise for taste. Every cook on FOODSbyme decides their own menu, sources their own ingredients, and puts their name on every dish.
            </p>
            <p className="text-stone leading-relaxed max-w-md">
              The result is food that tastes like it was made specifically for you — because it was.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-8">
              {['Made to order', 'No preservatives', 'Fresh daily', 'Allergen-aware'].map(tag => (
                <span key={tag} className="px-4 py-1.5 bg-warm text-stone rounded-full text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
