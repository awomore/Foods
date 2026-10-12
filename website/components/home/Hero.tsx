import Link from 'next/link';
import Image from 'next/image';
import { localePath, type Locale } from '@/lib/i18n/config';
import type { Dict } from '@/lib/i18n/dict';
import { AppBadges } from '@/components/site/AppBadges';
import HeroStatus from './HeroStatus';

type Dish = { img: string; key: keyof Dict['home']['dishes']; code: string; tall?: boolean };

// Where each dish comes from, not where FOODS operates. Nigeria is one origin among six.
const COLUMNS: Dish[][] = [
  [{ img: 'ramen', key: 'ramen', code: 'JP', tall: true }, { img: 'cake', key: 'cake', code: 'FR' }],
  [{ img: 'tacos', key: 'tacos', code: 'MX' }, { img: 'sourdough', key: 'sourdough', code: 'DE', tall: true }],
  [{ img: 'skewers', key: 'skewers', code: 'NG', tall: true }, { img: 'pho', key: 'pho', code: 'VN' }],
];

export default function Hero({ lang, t, common }: { lang: Locale; t: Dict['home']; common: Dict['common'] }) {
  return (
    <section className="bg-parchment pt-[72px]">
      <div className="container-x grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center pt-10 pb-16 md:pt-14 md:pb-24">
        <div className="min-w-0">
          <HeroStatus lang={lang} live={t.hero.live} available={t.hero.available} />
          <h1 className="hero-title mt-6 font-serif font-bold text-ink text-[clamp(2.6rem,6.2vw,5.6rem)] leading-[0.97] tracking-[-0.045em] [hyphens:auto] text-balance">
            <span className="block">{t.hero.titleA}</span>
            <span className="block font-light text-stone">{t.hero.titleB}</span>
          </h1>
          <p className="mt-6 text-[clamp(1.05rem,1.4vw,1.2rem)] leading-relaxed text-stone max-w-[34em]">{t.hero.lede}</p>
          <AppBadges t={common.appBadges} className="mt-8" />
          <Link
            href={localePath(lang, '/for-creators')}
            className="mt-7 inline-flex items-center gap-2 border-b border-border pb-1 text-[15px] font-medium text-ink hover:border-ink transition-colors"
          >
            {t.hero.creatorLink} <span aria-hidden className="rtl-flip">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 items-start" dir="ltr">
          {COLUMNS.map((col, i) => (
            <div key={i} className={`grid gap-2 sm:gap-2.5 ${i === 1 ? 'mt-11' : i === 2 ? 'mt-4' : ''}`}>
              {col.map((d) => (
                <figure key={d.img} className="relative m-0 overflow-hidden rounded-md bg-warm">
                  <Image
                    src={`/images/home/${d.img}.jpg`}
                    alt={t.dishes[d.key]}
                    width={560}
                    height={d.tall ? 720 : 560}
                    priority={i === 0}
                    sizes="(max-width: 1024px) 33vw, 200px"
                    className={`w-full object-cover ${d.tall ? 'aspect-[560/720]' : 'aspect-square'}`}
                  />
                  <figcaption
                    dir="auto"
                    className="absolute start-1.5 bottom-1.5 sm:start-2 sm:bottom-2 flex max-w-[calc(100%-12px)] items-baseline gap-1.5 rounded bg-parchment px-1.5 py-0.5 sm:px-2 sm:py-1 text-[11px] sm:text-[12.5px] font-medium text-ink"
                  >
                    <code className="hidden sm:inline font-mono text-[10.5px] text-[#C2410C]">{d.code}</code>
                    <span className="truncate">{t.dishes[d.key]}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
