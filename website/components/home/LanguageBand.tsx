import { LOCALES, type Locale } from '@/lib/i18n/config';

// "Food" in each of the 23 languages the app and the site ship in.
const FOOD: Record<Locale, string> = {
  en: 'Food', ja: 'ごはん', sw: 'Chakula', de: 'Essen', ar: 'طعام', es: 'Comida', ko: '음식',
  fr: 'Cuisine', hi: 'खाना', am: 'ምግብ', it: 'Cibo', th: 'อาหาร', pt: 'Refeição', tr: 'Yemek',
  zh: '美食', nl: 'Eten', bn: 'খাবার', pl: 'Jedzenie', ru: 'Еда', id: 'Makanan', uk: 'Їжа',
  ro: 'Mâncare', vi: 'Món ăn',
};

const ORDER = Object.keys(FOOD) as Locale[];

const SCRIPT_STACK =
  "'Bricolage Grotesque', Geist, 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Ethiopic', 'Noto Sans Thai', 'Noto Sans Bengali', system-ui, sans-serif";

export default function LanguageBand({ lang, caption }: { lang: Locale; caption: string }) {
  // The visitor's own word leads, in orange.
  const words = [lang, ...ORDER.filter((l) => l !== lang)];
  const list = (hidden: boolean) => (
    <div className="flex items-center flex-shrink-0 motion-reduce:flex-wrap" aria-hidden={hidden || undefined}>
      {words.map((l) => (
        <span key={l} className="flex items-center">
          <span
            lang={l}
            className={`whitespace-nowrap px-[clamp(14px,2vw,26px)] text-[clamp(30px,4.6vw,58px)] font-medium leading-tight tracking-[-0.02em] ${
              l === lang ? 'text-spice' : 'text-[#5C5C5C]'
            }`}
            style={{ fontFamily: SCRIPT_STACK }}
          >
            {FOOD[l]}
          </span>
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#262626]" />
        </span>
      ))}
    </div>
  );

  return (
    <section className="bg-ink text-cream overflow-hidden pt-9 pb-8" aria-label={caption}>
      {/* Load the scripts for the words in the band (unicode-range keeps this to the glyphs used). */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500&family=Noto+Sans+KR:wght@500&family=Noto+Sans+SC:wght@500&family=Noto+Sans+Arabic:wght@500&family=Noto+Sans+Devanagari:wght@500&family=Noto+Sans+Ethiopic:wght@500&family=Noto+Sans+Thai:wght@500&family=Noto+Sans+Bengali:wght@500&display=swap"
      />
      <div dir="ltr" className="flex w-max animate-band motion-reduce:w-auto motion-reduce:animate-none">
        {list(false)}
        <div className="motion-reduce:hidden flex">{list(true)}</div>
      </div>
      <div className="container-x mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-[15px] text-cream">{caption}</p>
        <code className="font-mono text-[12px] text-cream/50" dir="ltr">{LOCALES.join(' · ')}</code>
      </div>
    </section>
  );
}
