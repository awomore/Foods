import { Section, SectionHeading } from '@/components/ui/Section';
import { FadeUp } from '@/components/ui/FadeUp';
import { Counter } from '@/components/ui/Counter';
import { PLATFORM_STATS } from '@/lib/data';

const pillars = [
  {
    title: 'An audience, not a queue',
    body: 'Creators build a following — people who choose them, return to them, and tell others. Relationships compound where transactions don’t.',
  },
  {
    title: 'Many ways to earn',
    body: 'Orders, weekly menus, private dining, courses, digital products, and community gifting. One kitchen, multiple income streams.',
  },
  {
    title: 'Infrastructure underneath',
    body: 'Payments, logistics, trust, and analytics handled — so creators do the one thing only they can do: cook something worth following.',
  },
];

export default function CreatorEconomy() {
  return (
    <Section tone="parchment">
      <div className="container-x">
        <SectionHeading
          align="center"
          kicker="The creator food economy"
          title={
            <>
              Not another delivery app. <br className="hidden md:block" />
              The home of food <span className="text-gradient-spice italic">creators</span>.
            </>
          }
          intro="Everywhere else, creators turned their craft into careers. Food is the most universal craft in Africa — and it has been left out. FOODS gives cooks, bakers, and chefs the audience, tools, and economics that other creators take for granted."
        />

        {/* Stats */}
        <FadeUp delay={0.1}>
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-3xl overflow-hidden border border-border">
            {PLATFORM_STATS.map((s) => (
              <div key={s.label} className="bg-cream px-6 py-9 text-center">
                <p className="font-serif text-[clamp(2rem,4vw,3rem)] text-ink leading-none">
                  <Counter
                    to={s.value}
                    prefix={s.prefix}
                    suffix={s.suffix}
                    decimals={s.decimals ?? 0}
                  />
                </p>
                <p className="mt-3 text-[12px] text-stone font-medium tracking-wide leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeUp>

        {/* Pillars */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          {pillars.map((p, i) => (
            <FadeUp key={p.title} delay={i * 0.08}>
              <div className="h-full">
                <span className="font-serif text-spice text-3xl">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-serif text-2xl text-ink mt-4 mb-3">{p.title}</h3>
                <p className="text-stone leading-relaxed font-light">{p.body}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </Section>
  );
}
