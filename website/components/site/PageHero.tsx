import Link from 'next/link';
import Image from 'next/image';
import { FadeUp } from '@/components/ui/FadeUp';
import { Kicker } from '@/components/ui/Section';

type Cta = { label: string; href: string; variant?: 'primary' | 'ghost-light' | 'dark' | 'ghost' };

type PageHeroProps = {
  kicker: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  ctas?: Cta[];
  image?: string;
  imageAlt?: string;
  align?: 'left' | 'center';
};

function CtaButton({ cta }: { cta: Cta }) {
  const cls =
    cta.variant === 'primary'
      ? 'btn-primary'
      : cta.variant === 'dark'
      ? 'btn-dark'
      : cta.variant === 'ghost'
      ? 'btn-ghost'
      : 'btn-ghost-light';
  const external = cta.href.startsWith('http') || cta.href.startsWith('mailto') || cta.href.startsWith('tel');
  return external ? (
    <a href={cta.href} className={cls}>{cta.label}</a>
  ) : (
    <Link href={cta.href} className={cls}>{cta.label}</Link>
  );
}

/** Dark, premium inner-page hero. Optional background image. */
export default function PageHero({ kicker, title, intro, ctas, image, imageAlt, align = 'left' }: PageHeroProps) {
  const center = align === 'center';
  return (
    <section className="relative bg-ink text-cream overflow-hidden grain">
      {image && (
        <div className="absolute inset-0">
          <Image src={image} alt={imageAlt ?? ''} fill priority sizes="100vw" className="object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/60" />
        </div>
      )}
      {!image && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,rgba(200,75,49,0.18),transparent_55%)] bg-grid-dark" />
      )}

      <div className={`container-x relative pt-36 pb-20 md:pt-44 md:pb-28 ${center ? 'text-center' : ''}`}>
        <div className={center ? 'max-w-3xl mx-auto' : 'max-w-3xl'}>
          <FadeUp>
            <Kicker className={center ? 'justify-center' : ''}>{kicker}</Kicker>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h1 className="font-serif text-[clamp(2.6rem,6vw,5rem)] leading-[1.02] tracking-[-0.03em] mt-6 text-cream text-balance">
              {title}
            </h1>
          </FadeUp>
          {intro && (
            <FadeUp delay={0.12}>
              <p className={`mt-6 text-cream/65 text-lg md:text-xl font-light leading-relaxed text-pretty ${center ? 'mx-auto' : ''} max-w-xl`}>
                {intro}
              </p>
            </FadeUp>
          )}
          {ctas && ctas.length > 0 && (
            <FadeUp delay={0.18}>
              <div className={`mt-9 flex flex-col sm:flex-row gap-3 ${center ? 'justify-center' : ''}`}>
                {ctas.map((c) => (
                  <CtaButton key={c.label} cta={c} />
                ))}
              </div>
            </FadeUp>
          )}
        </div>
      </div>
    </section>
  );
}
