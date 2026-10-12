import type { MetadataRoute } from 'next';
import { POSTS } from '@/lib/data';
import { APIS } from '@/lib/apis';
import { LOCALES } from '@/lib/i18n/config';
import { languageAlternates, pageUrl } from '@/lib/seo';

export const dynamic = 'force-static';

type Freq = MetadataRoute.Sitemap[number]['changeFrequency'];

// Pages translated into every language: one entry per language, each listing its alternates.
const TRANSLATED: { path: string; priority: number; freq: Freq }[] = [
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
  { path: '/support', priority: 0.5, freq: 'monthly' },
  { path: '/refund-policy', priority: 0.4, freq: 'yearly' },
  { path: '/privacy', priority: 0.4, freq: 'yearly' },
  { path: '/terms', priority: 0.4, freq: 'yearly' },
  { path: '/imprint', priority: 0.2, freq: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const p of TRANSLATED) {
    const languages = languageAlternates(p.path);
    for (const lang of LOCALES) {
      entries.push({ url: pageUrl(lang, p.path), lastModified: now, changeFrequency: p.freq, priority: p.priority, alternates: { languages } });
    }
  }

  // Articles and API reference are English-only; list the English original.
  for (const post of POSTS) {
    entries.push({ url: pageUrl('en', `/blog/${post.slug}`), lastModified: new Date(post.iso), changeFrequency: 'monthly', priority: 0.6 });
  }
  for (const api of APIS) {
    entries.push({ url: pageUrl('en', `/developers/${api.slug}`), lastModified: now, changeFrequency: 'monthly', priority: 0.5 });
  }

  return entries;
}
