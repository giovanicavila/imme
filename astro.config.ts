import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://giovanicavila.github.io',
  base: '/DOM-enlightenment',
  output: "static",
  prefetch: true,
  compressHTML: true,
});