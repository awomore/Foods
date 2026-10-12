'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppBadges } from '@/components/site/AppBadges';
import { SITE } from '@/lib/site';
import { localePath, type Locale } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/rich';
import type { Dict } from '@/lib/i18n/dict';

// What a shared link points at, read from the URL the visitor opened.
type Target =
  | { kind: 'cook'; key: string }      // /cook/:id-or-username, /c/:handle
  | { kind: 'creator'; key: string }   // /creator/:profile-slug
  | { kind: 'post' }                   // /post/:id (the app has no post screen to open yet)
  | { kind: 'join' }                   // /join?ref=CODE
  | { kind: 'other' };

type Cook = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  location: string | null;
  average_rating: number | string | null;
  total_orders: number | null;
};

function readTarget(pathname: string): Target {
  const m = pathname.match(/^\/(cook|c|creator|post)\/([^/]+)/);
  if (m) {
    const key = decodeURIComponent(m[2]);
    if (m[1] === 'creator') return { kind: 'creator', key };
    if (m[1] === 'post') return { kind: 'post' };
    return { kind: 'cook', key };
  }
  if (/^\/join\/?$/.test(pathname)) return { kind: 'join' };
  return { kind: 'other' };
}

async function loadCook(t: Target): Promise<Cook | null> {
  if (t.kind !== 'cook' && t.kind !== 'creator') return null;
  const url = t.kind === 'cook'
    ? `${SITE.api}/cooks/${encodeURIComponent(t.key)}`
    : `${SITE.api}/creator-branding/slug/${encodeURIComponent(t.key)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  return (body.cook ?? body.branding ?? null) as Cook | null;
}

export default function ShareLanding({
  lang, t, badges,
}: { lang: Locale; t: Dict['share']; badges: Dict['common']['appBadges'] }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [cook, setCook] = useState<Cook | null | undefined>(undefined); // undefined = loading
  const [onPhone, setOnPhone] = useState(false);

  useEffect(() => {
    const tg = readTarget(window.location.pathname);
    setTarget(tg);
    setOnPhone(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    loadCook(tg).then(setCook, () => setCook(null));
  }, []);

  if (!target || ((target.kind === 'cook' || target.kind === 'creator') && cook === undefined)) {
    return <p className="text-stone text-lg" aria-live="polite">{t.loading}</p>;
  }

  // The app's scheme routes foodsbyme://cook/<id> to the cook's storefront.
  const deepLink = cook ? `foodsbyme://cook/${cook.id}` : 'foodsbyme://';
  const name = cook?.display_name?.trim() || t.aMaker;
  const rating = cook?.average_rating != null ? Number(cook.average_rating) : 0;

  let eyebrow = t.eyebrow;
  let title = t.genericTitle;
  let body = t.genericBody;
  if (cook) {
    title = name;
    body = fmt(t.cookBody, { name });
  } else if (target.kind === 'cook' || target.kind === 'creator') {
    title = t.missingTitle;
    body = t.missingBody;
  } else if (target.kind === 'post') {
    title = t.postTitle;
    body = t.postBody;
  } else if (target.kind === 'join') {
    eyebrow = t.joinEyebrow;
    title = t.joinTitle;
    body = t.joinBody;
  }

  return (
    <div className="w-full max-w-md">
      <p className="kicker mb-5">{eyebrow}</p>

      {cook && (
        <div className="mx-auto mb-6 w-24 h-24 rounded-full overflow-hidden bg-warm border border-ink/10 flex items-center justify-center">
          {cook.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cook.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-serif font-bold text-4xl text-ink">{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
      )}

      <h1 className="font-serif font-bold text-[clamp(2.2rem,6vw,3.6rem)] leading-[1.06] text-ink tracking-[-0.035em] text-balance break-words">
        {title}
      </h1>

      {cook && (cook.location || rating > 0 || (cook.total_orders ?? 0) > 0) && (
        <p className="mt-4 text-[14px] text-muted flex flex-wrap justify-center gap-x-3 gap-y-1">
          {cook.location && <span>{cook.location}</span>}
          {rating > 0 && <span>★ {rating.toFixed(1)}</span>}
          {(cook.total_orders ?? 0) > 0 && <span>{fmt(t.orders, { n: cook.total_orders ?? 0 })}</span>}
        </p>
      )}

      <p className="mt-5 text-stone text-lg leading-relaxed">{body}</p>

      {onPhone && (
        <div className="mt-8">
          <a href={deepLink} className="btn-primary w-full sm:w-auto justify-center">{t.openApp}</a>
        </div>
      )}

      <p className="mt-10 mb-4 text-[13px] text-muted">{t.getApp}</p>
      <AppBadges t={badges} className="justify-center items-center" />

      <p className="mt-10">
        <Link href={localePath(lang, '/')} className="text-[14px] text-stone hover:text-spice transition-colors underline underline-offset-4">
          {t.visitSite}
        </Link>
      </p>
    </div>
  );
}
