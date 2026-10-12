'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { SITE } from '@/lib/site';
import type { Dict } from '@/lib/i18n/dict';
import { fmt } from '@/lib/i18n/rich';

const TOPICS = [
  { id: 'general', email: SITE.email.hello },
  { id: 'creator', email: SITE.email.creators },
  { id: 'partnership', email: SITE.email.partnerships },
  { id: 'press', email: SITE.email.press },
  { id: 'support', email: SITE.email.support },
];

type FormData = { topic: string; name: string; email: string; message: string };
const empty: FormData = { topic: 'general', name: '', email: '', message: '' };

export default function ContactForm({ t }: { t: Dict['contact']['form'] }) {
  const [data, setData] = useState<FormData>(empty);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof FormData, v: string) => setData((d) => ({ ...d, [k]: v }));

  const valid =
    data.name.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(data.email) &&
    data.message.trim().length > 4;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const ti = Math.max(0, TOPICS.findIndex((x) => x.id === data.topic));
    const topic = { ...TOPICS[ti], label: t.topics[ti] };
    const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
    if (endpoint) {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, topicLabel: topic.label, source: 'website/contact' }),
      }).catch(() => {});
    } else {
      const subject = encodeURIComponent(`${topic.label}: ${data.name}`);
      const body = encodeURIComponent(`${data.message}\n\n— ${data.name}\n${data.email}`);
      window.location.href = `mailto:${topic.email}?subject=${subject}&body=${body}`;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card p-8 sm:p-10 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-spice text-cream flex items-center justify-center mx-auto mb-5">
          <Check size={26} />
        </div>
        <h3 className="font-serif text-2xl text-ink">{data.name ? fmt(t.thanks, { name: data.name.split(' ')[0] }) : t.thanksNoName}</h3>
        <p className="text-stone mt-3 font-light max-w-md mx-auto">
          {t.thanksBody}
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 sm:p-10 shadow-warm-lg">
      <div className="mb-6">
        <label className="block text-[13px] font-medium text-stone mb-2">{t.topicLabel}</label>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((tp, i) => (
            <button
              key={tp.id}
              type="button"
              onClick={() => set('topic', tp.id)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-all ${
                data.topic === tp.id ? 'bg-ink text-cream border-ink' : 'border-border text-stone hover:border-ink/25'
              }`}
            >
              {t.topics[i]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cf-name" className="block text-[13px] font-medium text-stone mb-2">{t.name}</label>
          <input
            id="cf-name"
            value={data.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={t.namePlaceholder}
            className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-spice focus:ring-1 focus:ring-spice outline-none transition-colors"
          />
        </div>
        <div>
          <label htmlFor="cf-email" className="block text-[13px] font-medium text-stone mb-2">{t.email}</label>
          <input
            id="cf-email"
            type="email"
            value={data.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-spice focus:ring-1 focus:ring-spice outline-none transition-colors"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="cf-message" className="block text-[13px] font-medium text-stone mb-2">{t.message}</label>
        <textarea
          id="cf-message"
          value={data.message}
          onChange={(e) => set('message', e.target.value)}
          rows={5}
          placeholder={t.messagePlaceholder}
          className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-spice focus:ring-1 focus:ring-spice outline-none transition-colors resize-none"
        />
      </div>

      <button type="submit" disabled={!valid} className={`btn-primary w-full mt-6 ${!valid ? 'opacity-40 cursor-not-allowed' : ''}`}>
        {t.send}
      </button>
      <p className="text-[12px] text-muted text-center mt-4">
        {t.replyTime}
      </p>
    </form>
  );
}
