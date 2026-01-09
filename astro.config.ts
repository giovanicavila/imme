import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://imme-navy.vercel.app/',
  output: "static",
  adapter: vercel({
    webAnalytics: { enabled: true }
  }),
  prefetch: true,
  compressHTML: true,
});