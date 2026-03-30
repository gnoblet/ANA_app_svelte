import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const base = url.searchParams.get('base');
  const where = url.searchParams.get('where') ?? '1=1';
  const outFields = url.searchParams.get('outFields') ?? '*';
  if (!base) return new Response('missing base', { status: 400 });
  const q = `${base.replace(/\/+$/, '')}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(outFields)}&f=json&outSR=4326&returnGeometry=true`;
  console.log('proxy arcgis GET', q);
  try {
    const r = await fetch(q);
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } });
  } catch (e: any) {
    console.error('proxy arcgis error', e);
    return new Response(String(e), { status: 502 });
  }
};
