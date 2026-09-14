import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('landing exposes one H1 and required semantic anchors', async () => {
  const page = await read('src/pages/index.astro');
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
  for (const id of ['capabilities', 'workflow', 'examples', 'security', 'install', 'faq']) {
    assert.match(page, new RegExp(`id=["']${id}["']`));
  }
});

test('base layout exposes canonical, social and structured metadata', async () => {
  const layout = await read('src/layouts/BaseLayout.astro');
  for (const marker of ['rel="canonical"', 'name="description"', 'property="og:title"', 'name="twitter:card"', 'application/ld+json']) {
    assert.ok(layout.includes(marker), `missing metadata marker: ${marker}`);
  }
});

test('crawler and generative discovery files expose the project', async () => {
  const robots = await read('public/robots.txt');
  const llms = await read('public/llms.txt');
  assert.match(robots, /User-agent:\s*\*/);
  assert.match(robots, /Sitemap:/);
  assert.match(llms, /Connect to Analytics/i);
  assert.match(llms, /EI Analytic/i);
  assert.match(llms, /Node\.js 18\+/i);
});

test('landing truthfully covers the documented industrial data surface', async () => {
  const page = await read('src/pages/index.astro');
  for (const capability of ['companies', 'areas', 'machines', 'points', 'axes', 'devices', 'historical', 'FFT', 'TWF', 'thermal', 'assignments']) {
    assert.match(page, new RegExp(capability, 'i'), `missing capability: ${capability}`);
  }
});
