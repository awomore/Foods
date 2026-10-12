import type { Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';

/** Nav + page + footer, in the page's language. */
export default function Shell({
  lang,
  overlay = false,
  mainClassName,
  children,
}: {
  lang: Locale;
  overlay?: boolean;
  mainClassName?: string;
  children: React.ReactNode;
}) {
  const t = getDict(lang);
  return (
    <>
      <SiteNav lang={lang} t={t.common} overlay={overlay} />
      <main className={mainClassName}>{children}</main>
      <SiteFooter lang={lang} t={t.common} tagline={t.meta.tagline} />
    </>
  );
}

/** Small banner for translated pages whose main content is English-only. */
export function EnglishOnlyNote({ lang, text }: { lang: Locale; text: string }) {
  if (lang === 'en') return null;
  return (
    <div className="bg-warm border-b border-border">
      <p lang={lang} className="container-x py-3 text-[13px] text-stone">{text}</p>
    </div>
  );
}
