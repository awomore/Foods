'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="rounded-2xl overflow-hidden border border-cream/10 bg-[#16100a]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-cream/10">
        <span className="text-[11px] uppercase tracking-[0.15em] text-cream/40 font-semibold">{label ?? 'Example'}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-[12px] text-cream/50 hover:text-cream transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check size={13} className="text-spice" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[12.5px] leading-relaxed text-cream/80 font-mono no-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MethodBadge({ method }: { method: string }) {
  const color =
    method === 'GET' ? 'bg-emerald-500/15 text-emerald-400'
    : method === 'POST' ? 'bg-spice/20 text-spice'
    : method === 'PATCH' ? 'bg-gold/20 text-gold'
    : 'bg-red-500/15 text-red-400';
  return (
    <span className={`text-[10px] font-bold tracking-wide px-2 py-1 rounded-md ${color}`}>{method}</span>
  );
}
