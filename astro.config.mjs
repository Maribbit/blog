// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://maribbit.com',
  integrations: [sitemap()],
  // Use static output - models are loaded client-side
  output: 'static',
});