// Tiny formatting helpers for dictionary strings.
//   rich('Food is how we *belong.*') → 'Food is how we ' + <span class="text-gradient-spice">belong.</span>
//   fmt('Live in {place}', { place: 'Berlin' }) → 'Live in Berlin'
// Translators keep the *asterisks* and {placeholders}; scripts/i18n-check.mjs verifies that.

export function rich(s: string, accentClass = 'text-gradient-spice'): React.ReactNode {
  const parts = s.split(/\*([^*]+)\*/g);
  if (parts.length === 1) return s;
  return parts.map((p, i) => (i % 2 ? <span key={i} className={accentClass}>{p}</span> : p));
}

/** The same string with the accent markers removed, for metadata and alt text. */
export const plain = (s: string) => s.replace(/\*/g, '');

export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
