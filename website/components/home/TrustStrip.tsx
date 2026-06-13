import { Marquee } from '@/components/ui/Marquee';

const items = [
  'Party jollof', 'Celebration cakes', 'Charcoal suya', 'Native soups',
  'Small chops', 'Private dining', 'Weekly menus', 'Pastry drops',
  'Grazing boxes', 'Pepper soup', 'Cooking courses', 'Spice guides',
];

export default function TrustStrip() {
  return (
    <div className="bg-ink border-t border-cream/10 py-5">
      <Marquee>
        {items.map((item) => (
          <span key={item} className="inline-flex items-center mx-6 text-cream/40 font-serif text-lg italic">
            {item}
            <span className="ml-12 text-spice/60" aria-hidden>✦</span>
          </span>
        ))}
      </Marquee>
    </div>
  );
}
