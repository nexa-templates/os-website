import { env } from 'cloudflare:workers';
export async function GET({ url }) {
  const id = env.SITE_ID;
  if (!id || !/^[a-f0-9]{32}$/.test(id)) return new Response('Choose a published website first.', { status: 404 });
  const site = await env.SITES.getByName(id).readPublic();
  if (!site) return new Response('Not found', { status: 404 });
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${site.document.pages.map(page => `<url><loc>${escape(`${url.origin}/${page.slug}`)}</loc><lastmod>${new Date(site.publishedAt).toISOString()}</lastmod></url>`).join('')}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
