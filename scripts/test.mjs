import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const directory = await mkdtemp(join(tmpdir(), 'nexa-website-'));
const origin = process.env.WEBSITE_TEST_ORIGIN || 'http://127.0.0.1:8898';
const owners = []; let server, browser, debugPage;
async function request(auth, path = '', method = 'GET', body, headers = {}) {
  const response = await fetch(`${origin}/api/sites${auth ? `/${auth.id}${path}` : ''}`, { method, headers: { ...(auth ? { authorization: `Bearer ${auth.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function create() { const result = await request(null, '', 'POST', {}); assert.equal(result.status, 201); const auth = { id: result.data.id, token: result.data.token }; owners.push(auth); return { auth, state: result.data }; }
async function contact(id, body) { return fetch(`${origin}/api/public/${id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
const editorURL = auth => `${origin}/editor#${new URLSearchParams({ site: auth.id, key: auth.token })}`;
async function startWorker(extra = []) {
  server = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--var', 'PREVIEW_MODE:true', '--config', 'dist/server/wrangler.json', '--ip', '127.0.0.1', '--port', '8898', '--persist-to', directory, ...extra], { env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local Worker did not start.')), 45000);
    let output = ''; const receive = chunk => { output += String(chunk); if (String(chunk).includes('Ready on')) { clearTimeout(timeout); resolve(); } };
    server.stdout.on('data', receive); server.stderr.on('data', receive);
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Worker exited ${code}: ${output}`)); });
  });
}
try {
  if (!process.env.WEBSITE_TEST_ORIGIN) {
    await startWorker();
  }
  const { auth, state: initial } = await create(), { auth: other } = await create();
  assert.equal((await fetch(`${origin}/api/sites/${auth.id}`)).status, 401);
  assert.equal((await request({ id: auth.id, token: '0'.repeat(64) })).status, 403);
  assert.equal((await request({ id: other.id, token: auth.token })).status, 403);
  assert.equal((await request(auth, '/messages')).data.messages.length, 0);
  assert.equal((await request(auth, '/publish', 'POST', { version: 1 }, { origin: 'https://foreign.example' })).status, 403);
  assert.equal((await fetch(`${origin}/s/${auth.id}/`)).status, 404);
  assert.equal((await contact(auth.id, { name: 'Visitor', email: 'visitor@example.test', message: 'Before publishing' })).status, 404);
  const doc = structuredClone(initial.document); doc.pages[0].headline = 'A published website';
  const race = await Promise.all(['First draft', 'Second draft'].map(headline => { const value = structuredClone(doc); value.pages[0].headline = headline; return request(auth, '', 'PUT', { document: value, version: 1 }); }));
  assert.deepEqual(race.map(result => result.status).sort(), [200, 409]);
  let current = (await request(auth)).data;
  assert.equal((await request(auth, '/publish', 'POST', { version: 1 })).status, 409);
  const invalid = structuredClone(current.document); invalid.pages[1].slug = 'contact';
  assert.equal((await request(auth, '', 'PUT', { version: current.version, document: invalid })).status, 400);
  assert.equal((await request(auth, '', 'PUT', { version: current.version, document: { ...doc, pages: [] } })).status, 400);
  assert.equal((await request(auth, '', 'PUT', { version: current.version, document: { ...doc, name: 'x'.repeat(120001) } })).status, 400);
  current = (await request(auth, '/publish', 'POST', { version: current.version })).data;
  let publicResponse = await fetch(`${origin}/s/${auth.id}/`); assert.equal(publicResponse.status, 200);
  const publishedHeadline = current.document.pages[0].headline; assert.ok((await publicResponse.text()).includes(publishedHeadline));
  const next = structuredClone(current.document); next.pages[0].headline = 'Private unpublished change';
  current = (await request(auth, '', 'PUT', { version: current.version, document: next })).data;
  assert.ok(!(await (await fetch(`${origin}/s/${auth.id}/`)).text()).includes('Private unpublished change'));
  const privatePreview = await fetch(`${origin}/preview/${auth.id}`, { method: 'POST', headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json', origin }, body: JSON.stringify({ document: next, slug: '' }) });
  assert.equal(privatePreview.status, 200); assert.ok((await privatePreview.text()).includes('Private unpublished change'));
  assert.equal((await fetch(`${origin}/preview/${auth.id}`)).status, 405);
  const enquiry = { name: 'API Visitor', email: 'visitor@example.test', message: '<script>unsafe()</script> A test enquiry.' };
  assert.equal((await contact(auth.id, enquiry)).status, 201);
  assert.equal((await contact(auth.id, { ...enquiry, website: 'automated' })).status, 202);
  assert.equal((await contact(auth.id, { ...enquiry, email: 'invalid' })).status, 400);
  const messages = (await request(auth, '/messages')).data.messages; assert.equal(messages.length, 1); assert.equal(messages[0].message, enquiry.message);
  assert.equal((await request(other, '/messages')).data.messages.length, 0);
  assert.equal((await fetch(`${origin}/api/sites/${auth.id}/messages`)).status, 401);
  assert.equal((await request(auth, `/messages/${messages[0].id}`, 'DELETE')).status, 200);
  assert.equal((await request(auth, '/messages')).data.messages.length, 0);
  current = (await request(auth, '/unpublish', 'POST', { version: current.version })).data;
  assert.equal(current.isPublished, false); assert.equal((await fetch(`${origin}/s/${auth.id}/`)).status, 404);
  assert.equal((await fetch(`${origin}/s/${auth.id}/sitemap.xml`)).status, 404);
  console.log('API: isolation, owner authorization, conflicts, size/validation limits, private drafts, protected preview, publish/unpublish, private enquiries and deletion passed.');

  await mkdir('artifacts', { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [], violations = []; debugPage = page;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (/Content Security Policy|Refused to execute|Refused to load/i.test(message.text())) violations.push(message.text()); });
  await page.goto(origin); await page.getByRole('heading', { name: 'Spaces for what comes next.' }).waitFor();
  await page.screenshot({ path: 'artifacts/website-desktop.png' });
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width}: no public overflow`);
      await page.screenshot({ path: `artifacts/website-${theme}-${width}.png`, fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: 'Open navigation' }).click(); await page.getByRole('link', { name: 'Contact', exact: false }).first().click();
  assert.equal(await page.getByRole('button', { name: 'Send enquiry', exact: false }).isDisabled(), true);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin);
  await page.getByRole('button', { name: 'Create your website', exact: false }).click();
  await page.locator('#workspace').waitFor();
  const params = new URLSearchParams(new URL(page.url()).hash.slice(1)), uiAuth = { id: params.get('site'), token: params.get('key') }; owners.push(uiAuth);
  assert.equal(await page.locator('select').count(), 0, 'No native dropdowns');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Editor ${width}: no overflow`);
    await page.screenshot({ path: `artifacts/website-editor-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Headline', { exact: true }).fill('Built with Astro. Ready for people.');
  await page.getByLabel('Page content', { exact: false }).fill('## Our studio\n\n**Real content**, safely rendered.\n\n<script>window.pwned=1</script><img id="unsafe" src=x onerror="window.pwned=1"><iframe src="https://foreign.example"></iframe>\n\n[Unsafe](javascript:alert(1))');
  await page.getByRole('button', { name: 'Preview draft', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  const frame = page.frameLocator('#draft-preview'); await frame.getByRole('heading', { name: 'Built with Astro. Ready for people.' }).waitFor();
  assert.equal(await frame.locator('.prose script, .prose img, .prose iframe, .prose [onerror], .prose a[href^="javascript:"]').count(), 0);
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: 'Preview draft', exact: true }).evaluate(button => button === document.activeElement), true);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByText('Draft saved. Publish when you are ready.', { exact: true }).waitFor();
  await page.reload(); await page.getByLabel('Headline', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Headline', { exact: true }).inputValue(), 'Built with Astro. Ready for people.');
  assert.equal((await fetch(`${origin}/s/${uiAuth.id}/`)).status, 404);
  await page.getByRole('button', { name: 'Publish', exact: true }).click(); await page.getByRole('link', { name: 'View published website', exact: false }).waitFor();
  const visitorContext = await browser.newContext({ viewport: { width: 390, height: 900 } }), visitor = await visitorContext.newPage();
  visitor.on('pageerror', e => errors.push(e.message));
  await visitor.goto(`${origin}/s/${uiAuth.id}/`); await visitor.getByRole('heading', { name: 'Built with Astro. Ready for people.' }).waitFor();
  assert.equal(await visitor.evaluate(() => window.pwned), undefined);
  assert.equal(await visitor.locator('meta[name=description]').getAttribute('content'), (await request(uiAuth)).data.document.pages[0].summary);
  assert.equal((await fetch(`${origin}/s/${uiAuth.id}/sitemap.xml`)).status, 200);
  await page.getByLabel('Headline', { exact: true }).fill('A private revision');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByText('Draft saved. Publish when you are ready.', { exact: true }).waitFor();
  await visitor.reload(); await visitor.getByRole('heading', { name: 'Built with Astro. Ready for people.' }).waitFor();
  await visitor.goto(`${origin}/s/${uiAuth.id}/contact`);
  await visitor.getByLabel('Your name', { exact: true }).fill('Browser Visitor'); await visitor.getByLabel('Email address', { exact: true }).fill('browser@example.test'); await visitor.getByLabel('Tell us about your project').fill('A real test message, stored privately.');
  await visitor.getByRole('button', { name: 'Send enquiry', exact: false }).click(); await visitor.getByText('Thank you. Your enquiry was saved for the website owner.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enquiries', exact: false }).click(); await page.getByRole('heading', { name: 'Browser Visitor' }).waitFor();
  assert.equal(await page.locator('.message').count(), 1);
  await page.getByRole('button', { name: 'Delete enquiry', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(await page.locator('.message').count(), 1);
  await page.getByRole('button', { name: 'Delete enquiry', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await page.locator('.empty-inbox').waitFor();
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByLabel('Navigation title').fill('Services'); await page.getByLabel('Page URL').fill('services'); await page.getByLabel('Headline', { exact: true }).fill('Services for your next project');
  await page.getByRole('button', { name: 'Publish', exact: true }).click(); await page.getByText('Your website is published. Open “View published website” to see it.', { exact: true }).waitFor();
  await visitor.goto(`${origin}/s/${uiAuth.id}/services`); await visitor.getByRole('heading', { name: 'Services for your next project' }).waitFor();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Website name', { exact: true }).fill('Our test studio'); await page.getByLabel('Light', { exact: true }).check();
  await page.getByRole('button', { name: 'Publish', exact: true }).click(); await page.getByText('Your website is published. Open “View published website” to see it.', { exact: true }).waitFor();
  await visitor.reload(); assert.equal(await visitor.locator('html').getAttribute('data-theme'), 'light'); assert.match(await visitor.title(), /Our test studio/);
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export content', exact: true }).click(); const download = await downloadEvent;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8')); assert.equal(backup.format, 'nexa-website-v1'); assert.equal(backup.document.name, 'Our test studio'); assert.equal(JSON.stringify(backup).includes(uiAuth.token), false);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await context.setOffline(true); await page.getByLabel('Headline', { exact: true }).fill('Recover my local draft');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#save-status').textContent === 'Unsaved local draft');
  await context.setOffline(false);
  const remote = (await request(uiAuth)).data, remoteDoc = structuredClone(remote.document); remoteDoc.pages[0].headline = 'Another editor changed this';
  assert.equal((await request(uiAuth, '', 'PUT', { document: remoteDoc, version: remote.version })).status, 200);
  await page.reload(); await page.getByLabel('Headline', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Headline', { exact: true }).inputValue(), 'Recover my local draft');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByText(/changed in another window/).waitFor();
  assert.equal(await page.getByLabel('Headline', { exact: true }).inputValue(), 'Recover my local draft');
  await page.getByRole('button', { name: 'Reload saved version', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[name=headline]').value === 'Another editor changed this');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#import').setInputFiles({ name: 'content.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await page.getByText('Content imported into your local draft.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Unpublish website', exact: true }).click(); await page.getByRole('button', { name: 'Confirm', exact: true }).click(); await page.getByText('Website unpublished.', { exact: true }).waitFor();
  assert.equal((await visitor.reload()).status(), 404);
  assert.deepEqual(errors, []); assert.deepEqual(violations.filter(text => !text.includes('sandboxed')), []);
  await visitorContext.close();
  if (!process.env.WEBSITE_TEST_ORIGIN) {
    const rootState = (await request(uiAuth)).data;
    assert.equal((await request(uiAuth, '/publish', 'POST', { version: rootState.version })).status, 200);
    server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve));
    await startWorker(['--var', `SITE_ID:${uiAuth.id}`]);
    const root = await fetch(origin); assert.equal(root.status, 200); const html = await root.text();
    assert.ok(html.includes(rootState.document.pages[0].headline)); assert.ok(!html.includes('data-create')); assert.ok(html.includes('href="/contact"'));
    assert.equal((await fetch(`${origin}/contact`)).status, 200);
    assert.equal((await fetch(`${origin}/editor`)).status, 200);
    const sitemap = await fetch(`${origin}/sitemap.xml`); assert.equal(sitemap.status, 200); assert.ok((await sitemap.text()).includes(`${origin}/contact`));
    assert.equal((await request(uiAuth)).data.document.name, rootState.document.name, 'Content survives a Worker restart');
    console.log('Root deployment: SITE_ID serves the published Astro site at /, page routes, sitemap and editor; storage survives restart.');
  }
  console.log('Browser: Astro pages, responsive themes, editor, safe preview, publishing, real contact/inbox flow, page creation, settings, backups, offline/conflict recovery, unpublish, zero JavaScript errors passed.');
} catch (error) {
  if (debugPage) { console.error(JSON.stringify({ notice: await debugPage.locator('#notice').allTextContents(), headings: await debugPage.locator('h1').allTextContents(), status: await debugPage.locator('#save-status').allTextContents() })); await debugPage.screenshot({ path: 'artifacts/test-failure.png', fullPage: true }).catch(() => {}); }
  throw error;
} finally {
  for (const auth of owners) { try { await request(auth, '', 'DELETE'); } catch {} }
  await browser?.close();
  if (server) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
  await rm(directory, { recursive: true, force: true });
}
