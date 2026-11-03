const status = document.querySelector('#site-status');
document.querySelector('[data-create]')?.addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true; status.textContent = 'Creating your website…';
  try {
    const response = await fetch('/api/sites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    const hash = new URLSearchParams({ site: result.id, key: result.token });
    location.href = `/editor#${hash}`;
  } catch (e) { status.textContent = e.message || 'Could not create a website. Try again.'; button.disabled = false; }
});
document.querySelector('.menu-toggle')?.addEventListener('click', event => {
  const button = event.currentTarget, open = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(open)); button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  document.querySelector('#site-navigation').classList.toggle('open', open);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const button = document.querySelector('.menu-toggle[aria-expanded="true"]');
  if (button) { button.click(); button.focus(); }
});
document.querySelector('#contact-form')?.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, fieldset = form.querySelector('fieldset'), status = form.querySelector('[role="status"]');
  const body = Object.fromEntries(new FormData(form)); fieldset.disabled = true; status.textContent = 'Sending…';
  try {
    const response = await fetch(`/api/public/${form.dataset.site}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    form.reset(); status.textContent = 'Thank you. Your enquiry was saved for the website owner.';
  } catch (e) { status.textContent = e.message || 'Could not send. Please try again.'; }
  finally { fieldset.disabled = false; }
});
