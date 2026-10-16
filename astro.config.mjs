// @ts-check
import { defineConfig } from 'astro/config';

// The production domain is not final yet (see README). Set SITE_URL at build time once it is.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://aigameatlas.com',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
