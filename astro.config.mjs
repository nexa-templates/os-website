import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  devToolbar: { enabled: false },
  // Keep executable code external; the Worker deliberately disallows inline scripts.
  vite: { build: { assetsInlineLimit: 0 } },
});
