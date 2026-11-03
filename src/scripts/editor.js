import { validateDocument } from '../lib/content.js';

const $ = id => document.getElementById(id), params = new URLSearchParams(location.hash.slice(1));
let auth = { id: params.get('site'), token: params.get('key') }, state, doc, selected = 'home', dirty = false, busy = false, panel = 'page';
const validAuth = () => /^[a-f0-9]{32}$/.test(auth.id || '') && /^[a-f0-9]{64}$/.test(auth.token || '');
const draftKey = () => `nexa-website-draft:${auth.id}:${auth.token}`;
const editorURL = () => `${location.origin}/editor#${new URLSearchParams({ site: auth.id, key: auth.token })}`;
function notice(message) { $('notice').textContent = message; }
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function remember() {
  try { localStorage.setItem('nexa-websites', JSON.stringify([{ ...auth, name: doc.name }, ...stored('nexa-websites', []).filter(item => item.id !== auth.id)].slice(0, 30))); }
  catch { notice('Browser storage is unavailable. Keep a copy of your private editor link.'); }
}
function persist() {
  try { if (dirty) localStorage.setItem(draftKey(), JSON.stringify({ document: doc, version: state.version })); else localStorage.removeItem(draftKey()); }
  catch { notice('Your local draft could not be stored. Save or export before closing this page.'); }
}
function changed() { dirty = true; persist(); update(); }
function update() {
  $('save-status').textContent = busy ? 'Working…' : dirty ? 'Unsaved local draft' : state?.isPublished && state.publishedVersion === state.version ? 'Published' : 'Draft saved';
  $('website-name').textContent = doc?.name || '';
  $('publish-detail').textContent = state?.isPublished ? `Last published ${new Date(state.publishedAt).toLocaleString()}. Saved drafts remain private until published.` : 'This website is not published yet.';
  $('live-link').href = `/s/${auth.id}/`; $('live-link').hidden = !state?.isPublished;
  $('unpublish').disabled = !state?.isPublished || busy;
  for (const button of document.querySelectorAll('#editor-actions button, #add-page, #move-page, #remove-page, #settings-panel button, #refresh-inbox, #messages button, #reload-saved, #import')) button.disabled = busy;
  $('save').disabled = busy || !dirty;
  $('unpublish').disabled = busy || !state?.isPublished;
  for (const fieldset of document.querySelectorAll('#page-form > fieldset, #settings-form > fieldset')) fieldset.disabled = busy;
}
async function request(path = '', method = 'GET', body) {
  const response = await fetch(`/api/sites/${auth.id}${path}`, { method, headers: { authorization: `Bearer ${auth.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) { if (response.status === 409) $('recovery').hidden = false; throw new Error(result.error || 'Request failed.'); }
  return result;
}
async function run(action) {
  if (busy) return; busy = true; update(); notice('');
  try { await action(); } catch (e) { notice(e.message || 'Could not connect. Your changes stay in this browser.'); }
  finally { busy = false; update(); }
}
function drawList() {
  $('page-list').replaceChildren(...doc.pages.map(page => {
    const button = document.createElement('button'); button.textContent = page.title; button.dataset.id = page.id;
    if (panel === 'page' && selected === page.id) button.setAttribute('aria-current', 'page');
    button.onclick = () => { selected = page.id; show('page'); }; return button;
  }));
}
function show(next) {
  panel = next; for (const name of ['page', 'settings', 'inbox']) $(`${name}-panel`).hidden = name !== panel;
  $('settings-tab').classList.toggle('active', panel === 'settings'); $('inbox-tab').classList.toggle('active', panel === 'inbox');
  drawList();
  if (panel === 'page') {
    const page = doc.pages.find(page => page.id === selected) || doc.pages[0]; selected = page.id;
    $('page-heading').textContent = page.title;
    for (const name of ['title', 'slug', 'eyebrow', 'headline', 'summary', 'body']) $('page-form').elements[name].value = page[name];
    $('page-form').elements.slug.readOnly = ['home', 'contact'].includes(page.id);
    $('remove-page').hidden = ['home', 'contact'].includes(page.id); $('move-page').hidden = doc.pages.indexOf(page) < 2;
  }
  if (panel === 'settings') {
    for (const name of ['name', 'tagline', 'email']) $('settings-form').elements[name].value = doc[name];
    $('settings-form').elements.theme.value = doc.theme;
  }
  update();
}
$('page-form').addEventListener('input', () => {
  const page = doc.pages.find(page => page.id === selected);
  for (const name of ['title', 'slug', 'eyebrow', 'headline', 'summary', 'body']) page[name] = $('page-form').elements[name].value;
  $('page-heading').textContent = page.title; drawList(); changed();
});
$('settings-form').addEventListener('input', () => {
  for (const name of ['name', 'tagline', 'email', 'theme']) doc[name] = $('settings-form').elements[name].value;
  changed();
});
for (const form of [$('settings-form'), $('page-form')]) form.addEventListener('submit', event => { event.preventDefault(); $('save').click(); });
async function save() {
  if (!dirty) return;
  const document = validateDocument(doc);
  state = await request('', 'PUT', { document, version: state.version }); doc = state.document;
  dirty = false; persist(); remember(); $('recovery').hidden = true;
}
$('save').onclick = () => run(async () => { await save(); notice('Draft saved. Publish when you are ready.'); });
$('publish').onclick = () => run(async () => {
  await save(); state = await request('/publish', 'POST', { version: state.version });
  notice('Your website is published. Open “View published website” to see it.');
});
$('preview').onclick = () => run(async () => {
  const response = await fetch(`/preview/${auth.id}`, { method: 'POST', headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ document: validateDocument(doc), slug: doc.pages.find(page => page.id === selected)?.slug || '' }) });
  if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Preview failed.'); }
  $('draft-preview').srcdoc = await response.text(); $('preview-dialog').showModal();
});
$('preview-dialog').querySelector('[data-close]').onclick = () => $('preview-dialog').close();
$('preview-dialog').addEventListener('close', () => $('preview').focus());
async function confirmAction(title, text) {
  const dialog = $('confirm-dialog'); $('confirm-heading').textContent = title; $('confirm-text').textContent = text;
  dialog.returnValue = ''; dialog.showModal();
  return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
}
$('add-page').onclick = () => {
  if (busy) return; if (doc.pages.length >= 12) return notice('You can have up to 12 pages.');
  let n = 1; while (doc.pages.some(page => page.slug === `new-page-${n}`)) n++;
  const page = { id: crypto.randomUUID(), slug: `new-page-${n}`, title: 'New page', eyebrow: '', headline: 'Make it yours.', summary: '', body: '' };
  doc.pages.push(page); selected = page.id; changed(); show('page'); $('page-form').elements.title.focus();
};
$('remove-page').onclick = async () => {
  if (busy || ['home', 'contact'].includes(selected)) return;
  if (!await confirmAction('Delete this page?', 'It will disappear from your website the next time you publish.')) return;
  doc.pages = doc.pages.filter(page => page.id !== selected); selected = 'home'; changed(); show('page');
};
$('move-page').onclick = () => {
  if (busy) return; const index = doc.pages.findIndex(page => page.id === selected); if (index < 2) return;
  [doc.pages[index - 1], doc.pages[index]] = [doc.pages[index], doc.pages[index - 1]]; changed(); show('page');
};
$('settings-tab').onclick = () => show('settings');
async function inbox() {
  const { messages } = await request('/messages'); $('inbox-count').textContent = String(messages.length); $('messages').replaceChildren();
  if (!messages.length) { const p = document.createElement('p'); p.className = 'empty-inbox'; p.textContent = 'No enquiries yet. Messages from your published contact page will appear here.'; $('messages').append(p); }
  for (const item of messages) {
    const article = document.createElement('article'); article.className = 'message';
    const name = document.createElement('h2'); name.textContent = item.name;
    const email = document.createElement('a'); email.href = `mailto:${item.email}`; email.textContent = item.email;
    const date = document.createElement('time'); date.textContent = new Date(item.createdAt).toLocaleString();
    const body = document.createElement('p'); body.textContent = item.message;
    const remove = document.createElement('button'); remove.textContent = 'Delete enquiry'; remove.className = 'danger';
    remove.onclick = async () => { if (!busy && await confirmAction('Delete this enquiry?', 'This permanently removes the message.')) run(async () => { await request(`/messages/${item.id}`, 'DELETE'); await inbox(); }); };
    article.append(name, email, date, body, remove); $('messages').append(article);
  }
}
$('inbox-tab').onclick = () => { show('inbox'); run(inbox); };
$('refresh-inbox').onclick = () => run(inbox);
$('copy-editor').onclick = () => run(async () => { await navigator.clipboard.writeText(editorURL()); $('copy-status').textContent = 'Copied. Keep this link private.'; });
function exportContent() {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'nexa-website-v1', document: doc }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'website-content.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('export').onclick = exportContent; $('export-recovery').onclick = exportContent;
$('import').onchange = async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file || busy) return;
  try {
    if (file.size > 120000) throw new Error('Choose a content backup smaller than 120 KB.');
    const imported = JSON.parse(await file.text()); if (imported.format !== 'nexa-website-v1') throw new Error('Choose a Nexa Website content backup.');
    const value = validateDocument(imported.document);
    if (!await confirmAction('Replace this draft?', 'Imported content replaces the local draft. The published website stays unchanged until you publish.')) return;
    doc = value; selected = 'home'; changed(); show('settings'); notice('Content imported into your local draft.');
  } catch (e) { notice(e.message); }
};
$('unpublish').onclick = async () => {
  if (busy || !await confirmAction('Unpublish this website?', 'Public pages and the contact form will become unavailable. Your draft and enquiries stay here.')) return;
  run(async () => { await save(); state = await request('/unpublish', 'POST', { version: state.version }); notice('Website unpublished.'); });
};
$('delete-site').onclick = async () => {
  if (busy || !await confirmAction('Delete this website permanently?', 'All pages, published content, and enquiries will be removed. Export your content first.')) return;
  run(async () => {
    await request('', 'DELETE'); dirty = false;
    try { localStorage.removeItem(draftKey()); localStorage.setItem('nexa-websites', JSON.stringify(stored('nexa-websites', []).filter(item => item.id !== auth.id))); } catch {}
    location.href = '/editor';
  });
};
$('reload-saved').onclick = async () => {
  if (busy || !await confirmAction('Reload the saved version?', 'This replaces your local changes. Export them first if you need to keep them.')) return;
  run(async () => { state = await request(); doc = state.document; dirty = false; persist(); $('recovery').hidden = true; show(panel); });
};
$('create').onclick = async () => {
  const button = $('create'); button.disabled = true;
  try {
    const response = await fetch('/api/sites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    location.href = `/editor#${new URLSearchParams({ site: result.id, key: result.token })}`; location.reload();
  } catch (e) { notice(e.message); button.disabled = false; }
};
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && state) { event.preventDefault(); $('save').click(); } });
async function start() {
  if (!validAuth()) {
    for (const item of stored('nexa-websites', [])) {
      if (!/^[a-f0-9]{32}$/.test(item.id) || !/^[a-f0-9]{64}$/.test(item.token)) continue;
      const link = document.createElement('a'); link.href = `/editor#${new URLSearchParams({ site: item.id, key: item.token })}`; link.textContent = `Continue editing ${item.name}`; link.onclick = () => { location.href = link.href; location.reload(); }; $('saved-sites').append(link);
    }
    return;
  }
  try {
    state = await request(); doc = state.document;
    const recovered = stored(draftKey(), null);
    if (recovered) {
      try { doc = validateDocument(recovered.document); dirty = true; if (recovered.version !== state.version) { state.version = recovered.version; $('recovery').hidden = false; } notice('Your unsaved local draft has been restored.'); } catch { notice('A damaged local draft could not be restored.'); }
    }
    $('start').hidden = true; $('workspace').hidden = false; $('editor-actions').hidden = false; remember(); show('page');
  } catch (e) { notice(e.message); }
}
start();
