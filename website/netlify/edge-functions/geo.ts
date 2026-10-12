// Netlify Edge Function: tells the page which country (and city) the visitor is in, from
// Netlify's IP geolocation. Nothing is stored. The page falls back to the browser time zone
// if this is unreachable (local dev, ad blockers).

type Geo = { country?: { code?: string }; city?: string };

export default async (_req: Request, context: { geo?: Geo }) =>
  new Response(JSON.stringify({ country: context.geo?.country?.code ?? null, city: context.geo?.city ?? null }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' },
  });

export const config = { path: '/api/geo' };
