// @ts-check
import { defineConfig } from 'astro/config';

// Production domain. Override with SITE_URL for preview deployments.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://makeaigames.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
