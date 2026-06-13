import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { POSTS } from '@/lib/data';
import { APIS } from '@/lib/apis';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPaths: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '/', priority: 1, freq: 'weekly' },
    { path: '/how-it-works', priority: 0.9, freq: 'monthly' },
    { path: '/for-creators', priority: 0.9, freq: 'monthly' },
    { path: '/for-customers', priority: 0.9, freq: 'monthly' },
    { path: '/communities', priority: 0.8, freq: 'monthly' },
    { path: '/fleet', priority: 0.9, freq: 'monthly' },
    { path: '/fleet/partner-types', priority: 0.7, freq: 'monthly' },
    { path: '/fleet/apply', priority: 0.8, freq: 'monthly' },
    { path: '/fleet/resources', priority: 0.7, freq: 'monthly' },
    { path: '/developers', priority: 0.7, freq: 'monthly' },
    { path: '/blog', priority: 0.8, freq: 'weekly' },
    { path: '/about', priority: 0.7, freq: 'monthly' },
    { path: '/careers', priority: 0.6, freq: 'weekly' },
    { path: '/press', priority: 0.6, freq: 'monthly' },
    { path: '/contact', priority: 0.6, freq: 'yearly' },
    { path: '/support', priority: 0.4, freq: 'yearly' },
    { path: '/data-deletion', priority: 0.2, freq: 'yearly' },
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${SITE.url}${p.path === '/' ? '' : p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));

  for (const post of POSTS) {
    entries.push({
      url: `${SITE.url}/blog/${post.slug}`,
      lastModified: new Date(post.iso),
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  for (const api of APIS) {
    entries.push({
      url: `${SITE.url}/developers/${api.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  return entries;
}
