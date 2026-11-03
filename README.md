# Nexa Website

The Nexa Templates deployment is a public **Preview** for testing this template. Its sample website is fictional; creating a website gives the visitor an isolated site and private editor link for testing editing, publishing and enquiries. The organization is for template development, not customer records. `vars.PREVIEW_MODE` is `"true"` in this repository; set it to `"false"` in a customer copy and deploy that copy to the customer's own account. Preview labels do not change draft or enquiry permissions. Hosting uses the published Cloudflare Worker, not GitHub Pages.

A working **Astro** website template with a small page editor, private drafts, publishing, and a private contact enquiry inbox. The example is an original, fictional architecture studio; replace its content with your own.

[Try the website](https://nexa-website-template.nexa-templates.workers.dev/) · [Public template repository](https://github.com/nexa-templates/website)

## What works

- Server-rendered Astro pages with page titles, descriptions, canonical URLs, social metadata, responsive navigation, and a sitemap for each published site.
- Create an isolated website; edit page headings, summaries, Markdown content, navigation titles and URLs. Add, reorder, and delete pages. Home and Contact are retained.
- Change the website name, tagline, public email, and dark/light appearance. No native browser dropdowns.
- Preview an unsaved draft, save it privately, and explicitly publish or unpublish it. Public visitors never read draft content.
- A real contact form stores enquiries in the owner's private inbox. Owners can read/delete messages and open their email app to reply. **It does not send emails or email notifications.**
- Export/import page content as JSON. Local drafts survive reload and offline saves; version conflicts keep your changes for export or deliberate replacement.
- Each website has its own SQLite Durable Object. The public example is immutable; “Create your website” creates separate storage.

This is a small website editor, not a drag-and-drop builder. The architecture illustration and page layouts are original source assets/components; change those in the Astro project. Image uploads, accounts, payment processing, analytics, collaborative editing, automatic backups, and email delivery are not included.

## Run locally

Use **Node 24** (or Node >=22.23.4) and npm >=9.6.5.

```sh
npm ci
npm run dev
```

Astro's Cloudflare adapter runs the real Workers runtime locally, including Durable Objects. Local data stays in `.wrangler/`. No production credentials are needed for development.

```sh
npm run build
npm run preview
```

## Deploy your own copy

Import `https://github.com/nexa-templates/website.git` into a new Nexa project, retaining it as the upstream template, or use GitHub's “Use this template”. Deploy to your own Cloudflare account:

1. Give `wrangler.jsonc` a unique Worker name. Never connect the copy to the public demo's Worker or storage. If multiple accounts are available, set `CLOUDFLARE_ACCOUNT_ID` to your account ID in the deployment environment.
2. Authenticate Wrangler with your account and run `npm ci && npm run deploy`. The SQLite Durable Object migration creates storage on first use. Cloudflare Workers paid features may be needed for your account.
3. Open your new Worker URL, create your website, and keep the **private editor link**. Customize the fictional sample content, then publish.
4. To serve that website at `/` and `/contact` instead of `/s/SITE_ID/`, add `"vars": { "SITE_ID": "your-32-character-site-id" }` to `wrangler.jsonc`, using the ID in your published website URL. Rebuild and deploy. `SITE_ID` is public, not your private editor key. The site must already exist in this same Worker's storage.
5. Connect your custom domain to this Worker in Cloudflare or Nexa. The root sitemap is `/sitemap.xml` when `SITE_ID` is configured. Preview and editor routes remain available.

Astro 7 uses the Cloudflare Vite plugin. `astro build` generates `dist/server/wrangler.json` and `.wrangler/deploy/config.json`; run `wrangler deploy` from the project directory after building. If deploying through an external wrapper, pass the absolute path to **`dist/server/wrangler.json`**, not the unbuilt source entrypoint. No KV, external database, or image service is needed; Astro sessions are disabled.

For Nexa **Build & deploy**, select the connected Worker and production branch, set root `/`, install command `npm ci`, build command `npm run build`, and deploy command `npx --no-install wrangler deploy --name "$NEXA_WORKER_NAME"`. Enable automatic deployments, run the initial build, and verify the intended commit succeeds with a saved deployment and Visit URL. Later production-branch pushes use the same pipeline. Keep project sign-in disabled for the public example; private editing uses its owner capability link.

## Access, privacy, and limits

The editor uses a randomly generated 256-bit owner capability in the URL **fragment**. Requests send it as an Authorization header; the server stores only its SHA-256 hash. Anyone with the complete editor link can edit, publish, read enquiries, or delete the site. Keep it private and backed up; there is no login, recovery email, or role system. The published URL never contains the key. This browser remembers editor links and drafts in local storage; use a private browser on shared devices. Exported content excludes credentials and enquiries.

Publishing makes the selected snapshot public. Enquiries stay private and are not end-to-end encrypted. They remain until the owner deletes them or the website. Add an appropriate privacy notice and retention process for your business before collecting real customer data.

Markdown is sanitized on the server with an explicit tag/attribute/scheme allowlist. HTML widgets, images, scripts, and unsafe links are removed. Plain-text form fields are escaped in Astro and inbox messages use `textContent`. The preview is sandboxed. Responses use no-referrer/no-store and a restrictive CSP; JavaScript and CSS are external files. Mutating requests reject foreign origins. Versions protect simultaneous draft saves and publish/unpublish actions.

Limits: 12 pages, 20,000 characters per page body, 100 KB total website content, 120 KB streamed JSON request limit, 100 enquiries per website, 5,000 characters per message. Creation is approximately 10/minute per IP/hostname; contact submissions approximately 5/minute per IP/site plus 20/minute per website and a honeypot. Cloudflare's edge limiter is approximate and shared networks share IP quotas. For a high-traffic public business site, add Turnstile or your chosen anti-spam service, operational monitoring, and backups.

## Verification

```sh
CHROMIUM_PATH=/path/to/chromium npm test
```

Tests build the actual Astro Worker and run it against isolated temporary Durable Object storage. They cover owner access and isolation, draft/public separation, protected preview, version conflicts, validation/bounds, publishing/unpublishing, sanitization, real contact submission and private inbox, page editing, content backups, offline recovery, mobile navigation, themes, dialogs, screenshots, and JavaScript errors. Test websites are deleted afterwards.

To run against your own deployed instance: `WEBSITE_TEST_ORIGIN=https://your-worker.example CHROMIUM_PATH=/path/to/chromium npm test`. This creates and deletes three isolated test websites, without touching existing websites. Use an instance without a configured `SITE_ID` for the demo/creation flow; root-domain deployment is additionally checked locally.

`artifacts/website-desktop.png` is the gallery capture (1440 × 1000); convert it to `preview.webp` after visual review. No real customer content or editor keys belong in screenshots or the public repository.

## Source map

- `src/components/SitePage.astro`: the website's Astro layout and page rendering.
- `src/pages/`: demo, public sites, root-site routes, editor, authenticated preview, sitemap and 404 routes.
- `src/lib/content.js`: starting content and shared validation.
- `src/lib/storage.js`: isolated SQLite storage, owner permissions, revisions, published snapshots, enquiries.
- `src/worker.js`: custom Astro Worker entrypoint, API routing, rate limits and response headers.
- `src/scripts/`: small browser controllers for navigation/forms and the editor.
- `public/`: original SVG illustration, favicon, external styles and robots rules.

MIT licensed. No third-party vendor designs, logos, fonts, trackers, or remote image dependencies.
