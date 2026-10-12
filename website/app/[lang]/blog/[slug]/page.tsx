import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import Shell, { EnglishOnlyNote } from '@/components/site/Shell';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { FadeUp } from '@/components/ui/FadeUp';
import { Kicker } from '@/components/ui/Section';
import { POSTS } from '@/lib/data';
import { LOCALES, localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { fmt } from '@/lib/i18n/rich';
import { formatDate } from '@/lib/i18n/date';
import { SITE } from '@/lib/site';
import { pageMeta, pageUrl, breadcrumbSchema, articleSchema } from '@/lib/seo';

type P = { params: { lang: Locale; slug: string } };

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => POSTS.map((p) => ({ lang, slug: p.slug })));
}

export function generateMetadata({ params }: P): Metadata {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) return {};
  const meta = pageMeta(params.lang, { title: post.title, description: post.excerpt, path: `/blog/${post.slug}`, ogImage: post.image });
  // The article itself is English; point every language version at the English original.
  return { ...meta, alternates: { canonical: pageUrl('en', `/blog/${post.slug}`) } };
}

export default function BlogPostPage({ params }: P) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.blog;
  const L = (p: string) => localePath(lang, p);
  const url = pageUrl('en', `/blog/${post.slug}`);
  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <Shell lang={lang} mainClassName="bg-parchment">
      <JsonLd
        data={[
          breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }]),
          articleSchema({ title: post.title, description: post.excerpt, slug: post.slug, date: post.iso, author: post.author, image: post.image }),
        ]}
      />
      <article>
        <div className="pt-[72px]">
          <EnglishOnlyNote lang={lang} text={t.englishNote} />
        </div>
        <div className="container-narrow pt-12 md:pt-16 pb-10">
          <FadeUp>
            <Link href={L('/blog')} className="inline-flex items-center gap-1.5 text-[13px] text-stone hover:text-ink mb-7">
              <ArrowLeft size={14} className="rtl-flip" /> {t.allStories}
            </Link>
            <Kicker><span lang="en">{post.category}</span></Kicker>
            <h1 lang="en" className="font-serif font-bold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.03em] text-ink mt-5 text-balance">
              {post.title}
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
              <span className="font-medium text-stone">{post.author}</span>
              <span lang="en">· {post.authorRole}</span>
              <span>· {formatDate(post.iso, lang)}</span>
              <span className="inline-flex items-center gap-1">· <Clock size={13} /> {fmt(d.common.ui.minRead, { n: post.readMins })}</span>
            </div>
          </FadeUp>
        </div>

        <div className="container-x mb-12">
          <FadeUp>
            <div className="relative aspect-[16/9] md:aspect-[2/1] rounded-3xl overflow-hidden max-w-5xl mx-auto">
              <Image src={post.image} alt="" fill priority sizes="(max-width:1024px) 100vw, 1024px" className="object-cover" />
            </div>
          </FadeUp>
        </div>

        <div className="container-narrow pb-20" lang="en" dir="ltr">
          <div className="space-y-6">
            {post.body.map((para, i) => (
              <FadeUp key={i} delay={Math.min(i * 0.03, 0.18)}>
                <p
                  className={`text-[18px] leading-[1.75] text-stone text-pretty ${
                    i === 0 ? 'first-letter:font-serif first-letter:font-bold first-letter:text-5xl first-letter:text-spice first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-[0.8]' : ''
                  }`}
                >
                  {para}
                </p>
              </FadeUp>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-muted font-medium me-1" lang={lang}>{t.share}</span>
            <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(url)}`} className="btn-ghost btn-sm">X</a>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`} className="btn-ghost btn-sm">WhatsApp</a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} className="btn-ghost btn-sm">LinkedIn</a>
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <section className="bg-cream py-20 md:py-24 border-t border-border">
          <div className="container-x">
            <h2 className="font-serif font-bold text-2xl md:text-3xl text-ink mb-10">{t.keepReading}</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {more.map((p) => (
                <Link key={p.slug} href={L(`/blog/${p.slug}`)} className="group grid sm:grid-cols-[40%_1fr] gap-5 card overflow-hidden hover:shadow-warm-lg transition-shadow duration-500">
                  <div className="relative aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-[10rem]">
                    <Image src={p.image} alt="" fill sizes="(max-width:640px) 100vw, 40vw" className="object-cover" />
                  </div>
                  <div className="p-6 sm:pe-7 sm:py-7">
                    <span className="text-[11px] font-semibold text-spice uppercase tracking-wide" lang="en">{p.category}</span>
                    <h3 lang="en" className="font-serif text-lg text-ink leading-snug mt-2 group-hover:text-spice transition-colors text-balance">{p.title}</h3>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-spice font-medium">
                      {t.read} <ArrowRight size={13} className="rtl-flip group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand
        title={t.postCtaTitle}
        intro={t.postCtaBody}
        ctas={[
          { label: d.common.nav.forCreators, href: L('/for-creators'), primary: true },
          { label: d.common.nav.getApp, href: SITE.app.ios },
        ]}
      />
    </Shell>
  );
}
