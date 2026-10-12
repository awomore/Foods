/** A calendar date in the reader's language: '2 June 2026', '2. Juni 2026', '2026年6月2日'. */
export function formatDate(iso: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
  } catch {
    return iso;
  }
}
