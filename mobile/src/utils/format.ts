const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  KES: 'KSh ',
  GHS: 'GH₵',
  ZAR: 'R',
  EGP: 'E£',
  TZS: 'TSh ',
  UGX: 'USh ',
  RWF: 'FRw ',
};

export function fmtCurrency(amount: number, currency = 'NGN'): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return sym + Number(amount).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

/** Format a date ISO string as dd-mm-yyyy */
export function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDateShort(iso);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86_400_000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172_800_000) return 'Yesterday';
  return fmtDateShort(iso);
}

export function fmtTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

/** Generates a short human-readable order reference from a UUID */
export function shortOrderRef(uuid: string): string {
  const hex = uuid.replace(/-/g, '').toUpperCase();
  return `FOODS-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function pluralise(n: number, singular: string, plural = singular + 's'): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
