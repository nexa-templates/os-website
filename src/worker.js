import { handle } from '@astrojs/cloudflare/handler';
import { json, fail, token, digest, payload, secretFrom, sameOrigin } from './lib/storage.js';
export { Website } from './lib/storage.js';

async function api(request, env) {
  const url = new URL(request.url), path = url.pathname;
  if (path === '/health') return json({ service: 'nexa-website', framework: 'Astro' });
  if (!sameOrigin(request)) return fail('Use this website’s own origin.', 403);
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) return fail('Method not allowed.', 405);
  let body;
  if (['POST', 'PUT'].includes(request.method)) { try { body = await payload(request); } catch { return fail('Send valid JSON smaller than 120 KB.'); } }
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (path === '/api/sites' && request.method === 'POST') {
    if (!(await env.CREATION_LIMIT.limit({ key: `${url.hostname}:${ip}` })).success) return fail('Too many websites created. Try again in a minute.', 429);
    const id = crypto.randomUUID().replaceAll('-', ''), secret = token();
    const response = await env.SITES.getByName(id).init(await digest(secret));
    return json({ ...await response.json(), id, token: secret }, response.status);
  }
  const contact = /^\/api\/public\/([a-f0-9]{32})\/messages$/.exec(path);
  if (contact && request.method === 'POST') {
    if (!(await env.CONTACT_LIMIT.limit({ key: `${url.hostname}:${contact[1]}:${ip}` })).success) return fail('Too many messages. Try again in a minute.', 429);
    return env.SITES.getByName(contact[1]).contact(body);
  }
  const match = /^\/api\/sites\/([a-f0-9]{32})(.*)$/.exec(path), secret = secretFrom(request);
  if (!match) return fail('Not found.', 404);
  if (!secret) return fail('Open your private editor link.', 401);
  return env.SITES.getByName(match[1]).owner(request.method, match[2], secret, body);
}

export default {
  async fetch(request, env, ctx) {
    let response;
    try { response = new URL(request.url).pathname.startsWith('/api/') || new URL(request.url).pathname === '/health' ? await api(request, env) : await handle(request, env, ctx); }
    catch { response = fail('Temporarily unavailable. Please try again.', 503); }
    response = new Response(response.body, response);
    response.headers.set('cache-control', 'no-store');
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('x-content-type-options', 'nosniff');
    response.headers.set('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'");
    response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    return response;
  },
};
