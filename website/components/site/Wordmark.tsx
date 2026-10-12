/** The FOODSbyme wordmark: FOODS in black, byme lighter, and the orange dot. */
export default function Wordmark({ tone = 'light', className = '' }: { tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span
      dir="ltr"
      className={`inline-flex items-baseline font-serif text-[22px] font-extrabold tracking-[-0.03em] ${
        tone === 'dark' ? 'text-cream' : 'text-ink'
      } ${className}`}
    >
      FOODS
      <span className={`font-normal ${tone === 'dark' ? 'text-cream/60' : 'text-muted'}`}>byme</span>
      <span aria-hidden className="ms-[3px] inline-block h-1.5 w-1.5 rounded-full bg-spice" />
    </span>
  );
}
