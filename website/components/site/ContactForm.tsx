'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { SITE } from '@/lib/site';

const TOPICS = [
  { id: 'general', label: 'General enquiry', email: SITE.email.hello },
  { id: 'creator', label: 'I’m a creator', email: SITE.email.creators },
  { id: 'partnership', label: 'Fleet / partnership', email: SITE.email.partnerships },
  { id: 'press', label: 'Press & media', email: SITE.email.press },
  { id: 'support', label: 'Order support', email: SITE.email.support },
];

type FormData = { topic: string; name: string; email: string; message: string };
const empty: FormData = { topic: 'general', name: '', email: '', message: '' };

export default function ContactForm() {
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
    const topic = TOPICS.find((t) => t.id === data.topic) ?? TOPICS[0];
    const endpoint = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT;
    if (endpoint) {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, topicLabel: topic.label, source: 'website/contact' }),
      }).catch(() => {});
    } else {
      const subject = encodeURIComponent(`${topic.label} — ${data.name}`);
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
        <h3 className="font-serif text-2xl text-ink">Thanks{data.name ? `, ${data.name.split(' ')[0]}` : ''} — message on its way.</h3>
        <p className="text-stone mt-3 font-light max-w-md mx-auto">
          We aim to reply within one business day. For anything urgent about a live order, the in-app support chat is fastest.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 sm:p-10 shadow-warm-lg">
      <div className="mb-6">
        <label className="block text-[13px] font-medium text-stone mb-2">What’s this about?</label>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => set('topic', t.id)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-all ${
                data.topic === t.id ? 'bg-ink text-cream border-ink' : 'border-border text-stone hover:border-ink/25'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cf-name" className="block text-[13px] font-medium text-stone mb-2">Full name</label>
          <input
            id="cf-name"
            value={data.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Ada Obi"
            className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-spice focus:ring-1 focus:ring-spice outline-none transition-colors"
          />
        </div>
        <div>
          <label htmlFor="cf-email" className="block text-[13px] font-medium text-stone mb-2">Email</label>
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
        <label htmlFor="cf-message" className="block text-[13px] font-medium text-stone mb-2">Message</label>
        <textarea
          id="cf-message"
          value={data.message}
          onChange={(e) => set('message', e.target.value)}
          rows={5}
          placeholder="Tell us how we can help…"
          className="w-full rounded-2xl border border-border bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-spice focus:ring-1 focus:ring-spice outline-none transition-colors resize-none"
        />
      </div>

      <button type="submit" disabled={!valid} className={`btn-primary w-full mt-6 ${!valid ? 'opacity-40 cursor-not-allowed' : ''}`}>
        Send message
      </button>
      <p className="text-[12px] text-muted text-center mt-4">
        We typically reply within one business day.
      </p>
    </form>
  );
}
