// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Production domain. Override with SITE_URL for preview deployments.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://makeaigames.com',
  // 'preserve': section indexes build to /tools/index.html, everything else to /tools/x.html.
  // GitHub Pages can't serve /tools.html when a /tools/ directory also exists.
  trailingSlash: 'ignore',
  build: {
    format: 'preserve',
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
