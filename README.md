# Website

Standalone Cloudflare application with customer-owned data.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nexa-templates/os-website)

## Run and deploy

Install dependencies using the included lockfile, run `npm run build`, then `npm run deploy`. Wrangler provisions the declared resources. No Nexa account or API key is required for the default configuration.

## Access

Published pages stay public. Protect `/editor`, `/preview` and `/api/sites` (including descendants) with the same Access application audience. Configure `ACCESS_ISSUER`, `ACCESS_AUD` and `APP_ORIGIN`. The Worker verifies signed tokens on every protected request; editor links remain required.

`PREVIEW_MODE=true` is only for an isolated public sample deployment with no customer data or live services. Real installations use `false`.
## Source

Adapted from [website](https://github.com/nexa-templates/website/tree/18ac17838289bdd1bafa6da0d6d1b3ac56a2da8a) at `18ac17838289bdd1bafa6da0d6d1b3ac56a2da8a`. Original license files are retained. These source files are ordinary Wrangler applications; no Nexa manifest is required.
