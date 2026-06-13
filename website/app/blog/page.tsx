import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowRight, Clock } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import PageHero from '@/components/site/PageHero';
import CtaBand from '@/components/site/CtaBand';
import JsonLd from '@/components/site/JsonLd';
import { Section } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { POSTS } from '@/lib/data';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Stories — creator journeys, recipes, and culture',
  description:
    'The FOODSbyme journal: creator success stories, the vision behind the creator food economy, fleet partner journeys, and the culture of African food.',
  path: '/blog',
  keywords: ['food creator stories', 'African food culture', 'creator economy blog', 'FOODSbyme journal'],
});

export default function BlogPage() {
  const [featured, ...rest] = POSTS;
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Stories', path: '/blog' }])} />
      <SiteNav />
      <main>
        <PageHero
          kicker="Stories"
          title={<>Notes from the <span className="text-gradient-spice italic">creator food economy</span></>}
          intro="Creator journeys, the thinking behind the platform, and the culture of African food — straight from the people building it."
        />

        {/* Featured */}
        <Section tone="parchment">
          <div className="container-x">
            <FadeUp>
              <Link
                href={`/blog/${featured.slug}`}
                className="group grid lg:grid-cols-2 gap-8 lg:gap-12 items-center card overflow-hidden hover:shadow-warm-lg transition-shadow duration-500"
              >
                <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[24rem]">
                  <Image src={featured.image} alt={featured.title} fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" priority />
                </div>
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 text-[12px] text-muted mb-4">
                    <span className="inline-flex items-center rounded-full bg-spice/10 text-spice font-semibold px-3 py-1">{featured.category}</span>
                    <span>{featured.date}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {featured.readMins} min</span>
                  </div>
                  <h2 className="font-serif text-[clamp(1.8rem,3.4vw,2.8rem)] leading-tight text-ink text-balance group-hover:text-spice transition-colors">
                    {featured.title}
                  </h2>
                  <p className="mt-4 text-stone font-light leading-relaxed text-pretty">{featured.excerpt}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-spice font-medium text-[15px]">
                    Read the story <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            </FadeUp>
          </div>
        </Section>

        {/* Grid */}
        <Section tone="cream" className="pt-0 md:pt-0">
          <div className="container-x">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rest.map((post, i) => (
                <FadeUp key={post.slug} delay={(i % 3) * 0.08}>
                  <Link href={`/blog/${post.slug}`} className="group block card overflow-hidden h-full hover:shadow-warm-lg hover:-translate-y-1 transition-all duration-500">
                    <div className="relative aspect-[16/10]">
                      <Image src={post.image} alt={post.title} fill sizes="(max-width:1024px) 50vw, 33vw" className="object-cover" />
                    </div>
                    <div className="p-7">
                      <div className="flex items-center gap-3 text-[12px] text-muted mb-3">
                        <span className="inline-flex items-center rounded-full bg-spice/10 text-spice font-semibold px-2.5 py-0.5">{post.category}</span>
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {post.readMins} min</span>
                      </div>
                      <h3 className="font-serif text-xl text-ink leading-snug group-hover:text-spice transition-colors text-balance">{post.title}</h3>
                      <p className="mt-3 text-stone font-light text-[14px] leading-relaxed line-clamp-3">{post.excerpt}</p>
                      <p className="mt-5 text-[12px] text-muted">{post.author} · {post.date}</p>
                    </div>
                  </Link>
                </FadeUp>
              ))}
            </div>
          </div>
        </Section>

        <CtaBand
          title="Want to be the next story?"
          intro="Open a kitchen, build a following, and write your own chapter of the creator food economy."
          tone="ink"
          ctas={[
            { label: 'For creators', href: '/for-creators', primary: true },
            { label: 'Talk to press', href: 'mailto:press@foodsbyme.com' },
          ]}
        />
      </main>
      <SiteFooter />
    </>
  );
}
