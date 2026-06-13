import type { Metadata } from 'next';
import { Clock, ShieldCheck, Headphones } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import JsonLd from '@/components/site/JsonLd';
import ApplyForm from '@/components/fleet/ApplyForm';
import { FadeUp } from '@/components/ui/FadeUp';
import { Kicker } from '@/components/ui/Section';
import { pageMeta, breadcrumbSchema } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Become a fleet partner — apply in 5 steps',
  description:
    'Apply to become a FOODS fleet partner in five short steps. No long forms. Choose your partner type, share your details, and our team responds within 48 hours.',
  path: '/fleet/apply',
  keywords: ['fleet partner application', 'become a delivery partner', 'delivery partner signup'],
});

const assurances = [
  { icon: Clock, title: '5 short steps', body: 'No long forms. It takes about two minutes.' },
  { icon: ShieldCheck, title: '48-hour response', body: 'Our partnerships team reviews and reaches out fast.' },
  { icon: Headphones, title: 'Human onboarding', body: 'A real ops lead guides you from sign-up to live.' },
];

export default function ApplyPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Fleet partners', path: '/fleet' }, { name: 'Apply', path: '/fleet/apply' }])} />
      <SiteNav />
      <main className="bg-parchment min-h-screen">
        <section className="container-x pt-32 pb-16 md:pt-40">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-start">
            {/* Left rail */}
            <div className="lg:sticky lg:top-28">
              <FadeUp>
                <Kicker>Become a partner</Kicker>
                <h1 className="font-serif text-[clamp(2.4rem,5vw,3.6rem)] leading-[1.05] tracking-[-0.02em] text-ink mt-5 text-balance">
                  Let’s build your delivery business.
                </h1>
                <p className="text-stone font-light text-lg mt-5 leading-relaxed max-w-md">
                  Five quick steps and you’re in the queue. Whether you ride one bike or run a logistics company, there’s a pathway for you.
                </p>
              </FadeUp>
              <FadeUp delay={0.1}>
                <ul className="mt-10 space-y-5">
                  {assurances.map((a) => {
                    const Icon = a.icon;
                    return (
                      <li key={a.title} className="flex gap-4">
                        <span className="w-11 h-11 rounded-2xl bg-cream border border-border flex items-center justify-center text-spice flex-shrink-0">
                          <Icon size={20} />
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold text-ink">{a.title}</span>
                          <span className="block text-[13px] text-stone font-light mt-0.5">{a.body}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </FadeUp>
            </div>

            {/* Form */}
            <div>
              <ApplyForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
