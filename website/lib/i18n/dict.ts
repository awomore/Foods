import en from '@/messages/en.json';
import am from '@/messages/am.json';
import ar from '@/messages/ar.json';
import bn from '@/messages/bn.json';
import de from '@/messages/de.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import hi from '@/messages/hi.json';
import id from '@/messages/id.json';
import it from '@/messages/it.json';
import ja from '@/messages/ja.json';
import ko from '@/messages/ko.json';
import nl from '@/messages/nl.json';
import pl from '@/messages/pl.json';
import pt from '@/messages/pt.json';
import ro from '@/messages/ro.json';
import ru from '@/messages/ru.json';
import sw from '@/messages/sw.json';
import th from '@/messages/th.json';
import tr from '@/messages/tr.json';
import uk from '@/messages/uk.json';
import vi from '@/messages/vi.json';
import zh from '@/messages/zh.json';
import type { Locale } from './config';

/** English is the source of truth; every other language mirrors its shape. */
export type Dict = typeof en;

const RAW: Record<Locale, unknown> = {
  en, am, ar, bn, de, es, fr, hi, id, it, ja, ko, nl, pl, pt, ro, ru, sw, th, tr, uk, vi, zh,
};

// A translation that is missing a key falls back to the English string rather than
// rendering nothing. Arrays are taken whole from the translation when present.
function fill(base: unknown, over: unknown): unknown {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base)) return Array.isArray(over) && over.length === base.length ? over : base;
  if (typeof base === 'object' && base !== null) {
    if (typeof over !== 'object') return base;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(base)) out[k] = fill((base as Record<string, unknown>)[k], (over as Record<string, unknown>)[k]);
    return out;
  }
  return typeof over === typeof base ? over : base;
}

const cache = new Map<Locale, Dict>();

export function getDict(lang: Locale): Dict {
  let d = cache.get(lang);
  if (!d) {
    d = (lang === 'en' ? en : fill(en, RAW[lang])) as Dict;
    cache.set(lang, d);
  }
  return d;
}
