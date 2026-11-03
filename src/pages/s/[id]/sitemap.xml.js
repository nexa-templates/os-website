import { env } from 'cloudflare:workers';
export async function GET({ params, url }) {
  if (!/^[a-f0-9]{32}$/.test(params.id)) return new Response('Not found', { status: 404 });
  const site = await env.SITES.getByName(params.id).readPublic();
  if (!site) return new Response('Not found', { status: 404 });
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${site.document.pages.map(page => `<url><loc>${escape(`${url.origin}/s/${params.id}/${page.slug}`)}</loc><lastmod>${new Date(site.publishedAt).toISOString()}</lastmod></url>`).join('')}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
