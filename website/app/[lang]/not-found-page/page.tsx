import type { Metadata } from 'next';
import Link from 'next/link';
import Shell from '@/components/site/Shell';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';

// Served by Netlify (with a 404 status) for any missing URL under /<lang>/.
type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  return { title: getDict(params.lang).notFound.metaTitle, robots: { index: false, follow: true } };
}

const LINKS = ['/for-creators', '/fleet', '/blog'];

export default function NotFoundPage({ params }: P) {
  const lang = params.lang;
  const t = getDict(lang).notFound;
  const L = (p: string) => localePath(lang, p);
  return (
    <Shell lang={lang} mainClassName="min-h-[72vh] bg-cream flex flex-col items-center justify-center text-center px-6 pt-32 pb-20">
      <p className="font-mono text-[12px] tracking-[0.12em] uppercase text-spice mb-5">404</p>
      <h1 className="font-serif font-bold text-[clamp(2.6rem,6vw,4.6rem)] leading-[1.06] text-ink tracking-[-0.035em] text-balance">{t.title}</h1>
      <p className="mt-5 text-stone text-lg max-w-md leading-relaxed">{t.body}</p>
      <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
        <Link href={L('/')} className="btn-primary">{t.home}</Link>
        <Link href={L('/support')} className="btn-ghost">{t.help}</Link>
      </div>
      <div className="mt-16 grid sm:grid-cols-3 gap-4 max-w-xl w-full text-start">
        {t.links.map((l, i) => (
          <Link key={LINKS[i]} href={L(LINKS[i])} className="card p-5 hover:shadow-warm transition-all duration-300 group">
            <p className="text-[13px] font-semibold text-ink group-hover:text-spice transition-colors">{l.label}</p>
            <p className="text-[12px] text-muted mt-0.5">{l.desc}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
