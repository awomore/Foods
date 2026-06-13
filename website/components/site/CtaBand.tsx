import Link from 'next/link';
import { FadeUp } from '@/components/ui/FadeUp';

type Cta = { label: string; href: string; primary?: boolean };

export default function CtaBand({
  title,
  intro,
  ctas,
  tone = 'spice',
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  ctas: Cta[];
  tone?: 'spice' | 'ink';
}) {
  const bg = tone === 'spice' ? 'bg-spice text-cream' : 'bg-ink text-cream';
  return (
    <section className={`relative overflow-hidden ${bg} grain`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255, 255, 255,0.12),transparent_55%)]" />
      <div className="container-x relative py-20 md:py-24 text-center">
        <FadeUp>
          <h2 className="font-serif text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.08] tracking-[-0.02em] max-w-3xl mx-auto text-balance">
            {title}
          </h2>
        </FadeUp>
        {intro && (
          <FadeUp delay={0.08}>
            <p className="mt-5 text-cream/75 text-lg font-light max-w-xl mx-auto">{intro}</p>
          </FadeUp>
        )}
        <FadeUp delay={0.14}>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            {ctas.map((c) => {
              const cls = c.primary
                ? 'btn px-7 py-3.5 bg-cream text-ink hover:bg-warm'
                : 'btn px-7 py-3.5 border border-cream/30 bg-cream/10 text-cream hover:bg-cream/20 backdrop-blur-sm';
              const external = c.href.startsWith('http') || c.href.startsWith('mailto');
              return external ? (
                <a key={c.label} href={c.href} className={cls}>{c.label}</a>
              ) : (
                <Link key={c.label} href={c.href} className={cls}>{c.label}</Link>
              );
            })}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
