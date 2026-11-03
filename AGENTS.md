# Nexa Website

Keep this a functional Astro website. Use `.astro` components and routes for rendering; the Cloudflare adapter and `src/worker.js` export the `Website` SQLite Durable Object. Deploy each customer copy to its own Worker/account. Never point it at the public demo's data.

Preserve private drafts versus published snapshots, capability authorization, version conflict protection, local draft recovery, sanitized Markdown, contact inbox privacy, explicit destructive confirmation, and content export/import. Owner keys must remain in URL fragments and Authorization headers; never put them in public links, logs, screenshots, source, or exported content. No email is sent by the current contact form.

Use Node >=22.23.4 and npm >=9.6.5; Node 24 is recommended. Run `npm ci`, `npm test` with `CHROMIUM_PATH`, and `npm run build` before publishing. Test local Cloudflare runtime behavior and separate visitor/owner browsers. Capture desktop/mobile layouts, check overflow, keyboard navigation and dialog focus. Use no native browser selects; use buttons/radio controls here, or the shared custom Solid Select if adding Solid dropdowns.

Astro's build generates `dist/server/wrangler.json`. Deploy using the generated config when invoking Wrangler from outside this repository. Change the Worker name for each customer. `SITE_ID` optionally makes one published site the root website; it is a public site ID, never an owner key. No accounts or other external bindings are required.

The bundled Northline Studio content is fictional. Customize content, illustration, layout, and branding for the customer; do not imply sample projects are real. Keep this repo public and free of credentials, `.dev.vars`, local storage, build output, test artifacts, or customer enquiries. Explain missing capabilities accurately; add external services only when actually configured and tested.
