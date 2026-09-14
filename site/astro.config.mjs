import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = process.env.PUBLIC_SITE_URL ?? 'https://legongoraek.github.io/connect-to-analytics/';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
});
