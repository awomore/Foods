import Shell, { EnglishOnlyNote } from './Shell';
import PageHero from './PageHero';
import type { Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { fmt } from '@/lib/i18n/rich';
import { formatDate } from '@/lib/i18n/date';
import type { LegalDoc } from '@/lib/legal';

/** A legal document: translated title and framing, English body. */
export default function LegalPage({ lang, title, intro, doc }: { lang: Locale; title: string; intro: string; doc: LegalDoc }) {
  const t = getDict(lang).legal;
  const [before, after] = t.questions.split('{email}');
  return (
    <Shell lang={lang}>
      <PageHero kicker={t.kicker} title={title} intro={`${fmt(t.updated, { date: formatDate(doc.updated, lang) })}. ${intro}`} />
      <EnglishOnlyNote lang={lang} text={t.notice} />
      <section className="bg-cream py-16 md:py-24">
        <div className="container-x max-w-2xl" lang="en" dir="ltr">
          <div className="space-y-10">
            {doc.sections.map((s) => (
              <div key={s.title}>
                <h2 className="font-serif font-bold text-xl text-ink mb-3">{s.title}</h2>
                <p className="text-stone text-[15px] leading-relaxed whitespace-pre-line">{s.content}</p>
                {s.bullets && (
                  <ul className="mt-3 space-y-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-stone text-[14px] leading-relaxed">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-spice flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.footer && <p className="mt-3 text-stone text-[14px] leading-relaxed italic">{s.footer}</p>}
              </div>
            ))}
          </div>
        </div>
        <div className="container-x max-w-2xl mt-14 pt-10 border-t border-border">
          <p className="text-muted text-[13px]">
            {before}
            <a href={`mailto:${doc.email}`} className="text-spice hover:underline">{doc.email}</a>
            {after}
          </p>
        </div>
      </section>
    </Shell>
  );
}
