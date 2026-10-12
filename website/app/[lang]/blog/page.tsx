import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowRight, Clock } from 'lucide-react';
import Shell from '@/components/site/Shell';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { POSTS } from '@/lib/data';
import { localePath, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n/dict';
import { fmt, rich } from '@/lib/i18n/rich';
import { formatDate } from '@/lib/i18n/date';
import { SITE } from '@/lib/site';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

type P = { params: { lang: Locale } };

export function generateMetadata({ params }: P): Metadata {
  const t = getDict(params.lang).blog;
  return pageMeta(params.lang, { title: t.metaTitle, description: t.metaDescription, path: '/blog' });
}

export default function BlogPage({ params }: P) {
  const lang = params.lang;
  const d = getDict(lang);
  const t = d.blog;
  const L = (p: string) => localePath(lang, p);
  const [featured, ...rest] = POSTS;
  return (
    <Shell lang={lang}>
      <JsonLd data={breadcrumbSchema(lang, [{ name: d.common.ui.home, path: '/' }, { name: t.kicker, path: '/blog' }])} />
      <PageHero kicker={t.kicker} title={rich(t.title)} intro={t.intro} />

      {lang !== 'en' && (
        <div className="bg-warm border-b border-border">
          <p className="container-x py-3 text-[13px] text-stone">{t.englishNote}</p>
        </div>
      )}

      {/* Featured */}
      <Section tone="parchment">
        <div className="container-x">
          <FadeUp>
            <Link
              href={L(`/blog/${featured.slug}`)}
              className="group grid lg:grid-cols-2 gap-8 lg:gap-12 items-center card overflow-hidden hover:shadow-warm-lg transition-shadow duration-500"
            >
              <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[24rem]">
                <Image src={featured.image} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" priority />
              </div>
              <div className="p-8 lg:p-12">
                <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted mb-4">
                  <span className="inline-flex items-center rounded-full bg-spice/10 text-spice font-semibold px-3 py-1" lang="en">{featured.category}</span>
                  <span>{formatDate(featured.iso, lang)}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {fmt(d.common.ui.min, { n: featured.readMins })}</span>
                </div>
                <h2 lang="en" className="font-serif font-bold text-[clamp(1.8rem,3.4vw,2.8rem)] leading-tight tracking-[-0.03em] text-ink text-balance group-hover:text-spice transition-colors">
                  {featured.title}
                </h2>
                <p lang="en" className="mt-4 text-stone leading-relaxed text-pretty">{featured.excerpt}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-spice font-medium text-[15px]">
                  {t.readStory} <ArrowRight size={16} className="rtl-flip group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          </FadeUp>
        </div>
      </Section>

      {/* Grid */}
      {rest.length > 0 && (
        <Section tone="cream" className="pt-0 md:pt-0">
          <div className="container-x">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rest.map((post, i) => (
                <FadeUp key={post.slug} delay={(i % 3) * 0.08}>
                  <Link href={L(`/blog/${post.slug}`)} className="group block card overflow-hidden h-full hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-500">
                    <div className="relative aspect-[16/10]">
                      <Image src={post.image} alt="" fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover" />
                    </div>
                    <div className="p-7">
                      <div className="flex items-center gap-3 text-[12px] text-muted mb-3">
                        <span className="inline-flex items-center rounded-full bg-spice/10 text-spice font-semibold px-2.5 py-0.5" lang="en">{post.category}</span>
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {fmt(d.common.ui.min, { n: post.readMins })}</span>
                      </div>
                      <h3 lang="en" className="font-serif text-xl text-ink leading-snug group-hover:text-spice transition-colors text-balance">{post.title}</h3>
                      <p lang="en" className="mt-3 text-stone text-[14px] leading-relaxed line-clamp-3">{post.excerpt}</p>
                      <p className="mt-5 text-[12px] text-muted">{post.author} · {formatDate(post.iso, lang)}</p>
                    </div>
                  </Link>
                </FadeUp>
              ))}
            </div>
          </div>
        </Section>
      )}

      <CtaBand
        title={t.ctaTitle}
        intro={t.ctaBody}
        tone="ink"
        ctas={[
          { label: d.common.nav.forCreators, href: L('/for-creators'), primary: true },
          { label: t.ctaPress, href: `mailto:${SITE.email.press}` },
        ]}
      />
    </Shell>
  );
}
