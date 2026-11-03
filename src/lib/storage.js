import { DurableObject } from 'cloudflare:workers';
import { sample, validateDocument } from './content.js';

export const json = (data, status = 200) => Response.json(data, { status });
export const fail = (error, status = 400) => json({ error }, status);
export const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
export const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
export const snapshot = state => ({ document: state.document, version: state.version, publishedVersion: state.publishedVersion, publishedAt: state.publishedAt, isPublished: Boolean(state.published) });

export class Website extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, createdAt INTEGER NOT NULL)');
  }
  load() { const row = this.sql.exec('SELECT value FROM state WHERE id = 1').toArray()[0]; return row ? JSON.parse(row.value) : null; }
  store(state) { this.sql.exec('INSERT OR REPLACE INTO state VALUES (1, ?)', JSON.stringify(state)); }
  init(ownerHash) {
    if (this.load()) return fail('Website already exists.', 409);
    const state = { ownerHash, document: structuredClone(sample), version: 1, published: null, publishedVersion: 0, publishedAt: null };
    this.store(state); return json(snapshot(state), 201);
  }
  readPublic() { const state = this.load(); return state?.published ? { document: state.published, publishedAt: state.publishedAt } : null; }
  async owner(method, path, secret, body) {
    const hash = await digest(secret), state = this.load();
    if (!state || hash !== state.ownerHash) return fail('This editor link is invalid or the website was deleted.', 403);
    if (method === 'GET' && path === '') return json(snapshot(state));
    if (method === 'POST' && path === '/preview') {
      try { return json({ document: validateDocument(body?.document) }); } catch (e) { return fail(e.message); }
    }
    if (method === 'GET' && path === '/messages') return json({ messages: this.sql.exec('SELECT * FROM messages ORDER BY createdAt DESC, id').toArray() });
    const message = /^\/messages\/([a-f0-9-]{36})$/.exec(path);
    if (method === 'DELETE' && message) { this.sql.exec('DELETE FROM messages WHERE id = ?', message[1]); return json({ deleted: true }); }
    if (method === 'DELETE' && path === '') {
      this.ctx.storage.transactionSync(() => { this.sql.exec('DELETE FROM state'); this.sql.exec('DELETE FROM messages'); });
      return json({ deleted: true });
    }
    if (!(method === 'PUT' && path === '') && !(method === 'POST' && ['/publish', '/unpublish'].includes(path))) return fail('Not found.', 404);
    if (body?.version !== state.version) return fail('This website changed in another window. Your local draft is safe. Export it or reload the saved version before continuing.', 409);
    if (method === 'PUT') {
      try { state.document = validateDocument(body.document); } catch (e) { return fail(e.message); }
    }
    state.version++;
    if (path === '/publish') { state.published = structuredClone(state.document); state.publishedVersion = state.version; state.publishedAt = Date.now(); }
    if (path === '/unpublish') { state.published = null; state.publishedVersion = 0; state.publishedAt = null; }
    this.store(state); return json(snapshot(state));
  }
  contact(body) {
    if (!this.load()?.published) return fail('This website is not published.', 404);
    if (body?.website) return json({ received: true }, 202); // Honeypot: do not store automated submissions.
    if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100 || typeof body.email !== 'string' || body.email.length > 200 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.email) || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 5000) return fail('Enter your name, a valid email, and a message of up to 5,000 characters.');
    if (this.sql.exec('SELECT COUNT(*) AS count FROM messages').one().count >= 100) return fail('The enquiry inbox is full. Please use the listed email address.', 429);
    if (this.sql.exec('SELECT COUNT(*) AS count FROM messages WHERE createdAt > ?', Date.now() - 60000).one().count >= 20) return fail('Too many enquiries. Please try again later.', 429);
    this.sql.exec('INSERT INTO messages VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), body.name.trim(), body.email.trim(), body.message.trim(), Date.now());
    return json({ received: true }, 201);
  }
}

export async function payload(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Send JSON.');
  const reader = request.body?.getReader(); if (!reader) throw new Error('Missing body.');
  const chunks = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 120000) { await reader.cancel(); throw new Error('Request too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export const secretFrom = request => /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') || '')?.[1];
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}
