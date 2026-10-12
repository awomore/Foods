import type { Metadata } from 'next';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { SITE } from '@/lib/site';
import { pageMeta } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).dataDeletion;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/data-deletion', noindex: true });
}

/** Renders a sentence with {email} replaced by a mailto link. */
function withEmail(s: string, email: string) {
  const [a, b] = s.split('{email}');
  return (
    <>
      {a}
      <a href={`mailto:${email}`} className="text-spice font-medium hover:underline">{email}</a>
      {b}
    </>
  );
}

export default function DataDeletionPage({ params }: P) {
  const lang = params.lang;
  const t = getDict(lang).dataDeletion;
  const email = SITE.email.privacy;
  return (
    <Shell lang={lang}>
      <PageHero kicker={t.kicker} title={t.title} />
      <section className="bg-parchment py-16 md:py-20">
        <div className="container-narrow space-y-10 text-[16px] leading-relaxed text-stone">
          <p>{withEmail(t.intro, email)}</p>

          <div>
            <h2 className="font-serif font-bold text-xl text-ink mb-3">{t.facebookTitle}</h2>
            <p>{t.facebookBody}</p>
            <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm mt-4">
              {t.facebookLink}
            </a>
          </div>

          <div>
            <h2 className="font-serif font-bold text-xl text-ink mb-3">{t.whatTitle}</h2>
            <ul className="space-y-2">
              {t.what.map((w) => (
                <li key={w} className="flex items-start gap-3">
                  <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-spice flex-shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] text-muted">
              {t.retention}{' '}
              <a href={localePath(lang, '/privacy')} className="text-spice hover:underline">{getDict(lang).common.legalNav.privacy}</a>
            </p>
          </div>

          <p className="border-t border-border pt-8 text-[14px]">{withEmail(t.questions, email)}</p>
        </div>
      </section>
    </Shell>
  );
}
