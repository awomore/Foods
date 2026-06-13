import { FadeUp } from './FadeUp';

export function Kicker({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`kicker kicker-dot ${className}`}>
      {children}
    </span>
  );
}

type SectionHeadingProps = {
  kicker?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: 'left' | 'center';
  tone?: 'dark' | 'light';
  className?: string;
};

export function SectionHeading({
  kicker,
  title,
  intro,
  align = 'left',
  tone = 'dark',
  className = '',
}: SectionHeadingProps) {
  const isCenter = align === 'center';
  const titleColor = tone === 'light' ? 'text-cream' : 'text-ink';
  const introColor = tone === 'light' ? 'text-cream/60' : 'text-stone';
  return (
    <div className={`${isCenter ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl'} ${className}`}>
      {kicker && (
        <FadeUp>
          <Kicker className={isCenter ? 'justify-center' : ''}>{kicker}</Kicker>
        </FadeUp>
      )}
      <FadeUp delay={0.06}>
        <h2
          className={`font-serif text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.08] tracking-[-0.02em] mt-5 ${titleColor} text-balance`}
        >
          {title}
        </h2>
      </FadeUp>
      {intro && (
        <FadeUp delay={0.12}>
          <p className={`mt-5 text-base md:text-lg leading-relaxed font-light ${introColor} text-pretty`}>
            {intro}
          </p>
        </FadeUp>
      )}
    </div>
  );
}

type SectionProps = {
  id?: string;
  children: React.ReactNode;
  className?: string;
  tone?: 'parchment' | 'cream' | 'ink' | 'charcoal';
};

const toneClass = {
  parchment: 'bg-parchment text-ink',
  cream: 'bg-cream text-ink',
  ink: 'bg-ink text-cream',
  charcoal: 'bg-charcoal text-cream',
};

export function Section({ id, children, className = '', tone = 'parchment' }: SectionProps) {
  return (
    <section id={id} className={`relative py-20 md:py-28 ${toneClass[tone]} ${className}`}>
      {children}
    </section>
  );
}
