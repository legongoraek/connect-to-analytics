import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = process.env.PUBLIC_SITE_URL ?? 'https://connect-to-analytics-site.vercel.app/';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
});
