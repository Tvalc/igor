// @ts-check
import { defineConfig } from 'astro/config';

// Production domain. Override with SITE_URL for preview deployments.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://makeaigames.com',
  // 'preserve': section indexes build to /tools/index.html, everything else to /tools/x.html.
  // GitHub Pages can't serve /tools.html when a /tools/ directory also exists.
  trailingSlash: 'ignore',
  build: {
    format: 'preserve',
  },
});
