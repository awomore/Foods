'use client';

/** Seamless infinite marquee. Renders children twice for a continuous loop. */
export function Marquee({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden pause-on-hover ${className}`}>
      <div className="flex w-max animate-marquee">
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children}
        </div>
      </div>
    </div>
  );
}
