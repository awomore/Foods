import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { FadeUp } from '@/components/ui/FadeUp';
import { Kicker } from '@/components/ui/Section';
import { POSTS } from '@/lib/data';
import { pageMeta, breadcrumbSchema, articleSchema } from '@/lib/seo';

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) return {};
  return pageMeta({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    keywords: [post.category.toLowerCase(), 'FOODSbyme', 'creator food economy', 'African food'],
    ogImage: post.image,
  });
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();

  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Stories', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }]),
          articleSchema({ title: post.title, description: post.excerpt, slug: post.slug, date: post.iso, author: post.author, image: post.image }),
        ]}
      />
      <SiteNav />
      <main className="bg-parchment">
        <article>
          {/* Header */}
          <div className="container-narrow pt-32 md:pt-40 pb-10">
            <FadeUp>
              <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] text-stone hover:text-ink mb-7">
                <ArrowLeft size={14} /> All stories
              </Link>
              <Kicker>{post.category}</Kicker>
              <h1 className="font-serif text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.02em] text-ink mt-5 text-balance">
                {post.title}
              </h1>
              <div className="mt-6 flex items-center gap-3 text-[13px] text-muted">
                <span className="font-medium text-stone">{post.author}</span>
                <span>· {post.authorRole}</span>
                <span>· {post.date}</span>
                <span className="inline-flex items-center gap-1">· <Clock size={13} /> {post.readMins} min read</span>
              </div>
            </FadeUp>
          </div>

          {/* Hero image */}
          <div className="container-x mb-12">
            <FadeUp>
              <div className="relative aspect-[16/9] md:aspect-[2/1] rounded-3xl overflow-hidden max-w-5xl mx-auto">
                <Image src={post.image} alt={post.title} fill priority sizes="(max-width:1024px) 100vw, 1024px" className="object-cover" />
              </div>
            </FadeUp>
          </div>

          {/* Body */}
          <div className="container-narrow pb-20">
            <div className="space-y-6">
              {post.body.map((para, i) => (
                <FadeUp key={i} delay={Math.min(i * 0.03, 0.18)}>
                  <p
                    className={`text-[18px] leading-[1.75] text-stone font-light text-pretty ${
                      i === 0
                        ? 'first-letter:font-serif first-letter:text-5xl first-letter:text-spice first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-[0.8]'
                        : ''
                    }`}
                  >
                    {para}
                  </p>
                </FadeUp>
              ))}
            </div>

            {/* Share */}
            <div className="mt-12 pt-8 border-t border-border flex flex-wrap items-center gap-3">
              <span className="text-[13px] text-muted font-medium mr-1">Share this story</span>
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://foodsbyme.com/blog/${post.slug}`)}`}
                className="btn-ghost btn-sm"
                aria-label="Share on X"
              >
                Share on X
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${post.title} — https://foodsbyme.com/blog/${post.slug}`)}`}
                className="btn-ghost btn-sm"
                aria-label="Share on WhatsApp"
              >
                WhatsApp
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://foodsbyme.com/blog/${post.slug}`)}`}
                className="btn-ghost btn-sm"
                aria-label="Share on LinkedIn"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </article>

        {/* More stories */}
        <section className="bg-cream py-20 md:py-24 border-t border-border">
          <div className="container-x">
            <h2 className="font-serif text-2xl md:text-3xl text-ink mb-10">Keep reading</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {more.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="group grid sm:grid-cols-[40%_1fr] gap-5 card overflow-hidden hover:shadow-warm-lg transition-shadow duration-500">
                  <div className="relative aspect-[4/3] sm:aspect-auto sm:h-full sm:min-h-[10rem]">
                    <Image src={p.image} alt={p.title} fill sizes="(max-width:640px) 100vw, 40vw" className="object-cover" />
                  </div>
                  <div className="p-6 sm:pr-7 sm:py-7">
                    <span className="text-[11px] font-semibold text-spice uppercase tracking-wide">{p.category}</span>
                    <h3 className="font-serif text-lg text-ink leading-snug mt-2 group-hover:text-spice transition-colors text-balance">{p.title}</h3>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-spice font-medium">
                      Read <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <CtaBand
          title="The next chapter is yours to cook."
          intro="Join the creators building audiences, income, and communities on FOODS."
          ctas={[
            { label: 'For creators', href: '/for-creators', primary: true },
            { label: 'Get the app', href: 'https://apps.apple.com/app/foodsbyme' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
