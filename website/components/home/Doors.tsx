import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { localePath, type Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n/dict';

const DOORS = [
  { img: 'eat', href: '/for-customers' },
  { img: 'cook', href: '/for-creators' },
  { img: 'courier', href: '/fleet' },
];

export default function Doors({ lang, t }: { lang: Locale; t: Dict['home']['doors'] }) {
  return (
    <section className="bg-parchment py-[clamp(64px,9vw,120px)]">
      <div className="container-x">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">{t.kicker}</p>
        <h2 className="mt-3 font-serif font-bold text-[clamp(2.1rem,4.4vw,3.75rem)] leading-none tracking-[-0.035em] text-ink text-balance">
          {t.title}
        </h2>
        <div className="mt-[clamp(32px,4vw,52px)] grid md:grid-cols-3 gap-9 md:gap-7">
          {t.items.map((d, i) => (
            <Link key={DOORS[i].href} href={localePath(lang, DOORS[i].href)} className="group grid content-start gap-4">
              <div className="overflow-hidden rounded-md bg-warm aspect-[4/3]">
                <Image
                  src={`/images/home/${DOORS[i].img}.jpg`}
                  alt=""
                  width={800}
                  height={600}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="h-full w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-[1.04]"
                />
              </div>
              <span className="font-mono text-[12px] tracking-[0.04em] text-[#C2410C]">{d.tag}</span>
              <h3 className="font-serif text-[clamp(1.35rem,2vw,1.7rem)] font-semibold leading-tight tracking-[-0.02em] text-ink">{d.title}</h3>
              <p className="text-[15.5px] text-stone">{d.body}</p>
              <span className="inline-flex items-center gap-1.5 text-[14.5px] font-medium text-ink">
                {d.cta} <ArrowRight size={15} className="rtl-flip transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
