import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// Runs after `npm run build`: every absolute URL a crawler follows must point at the deployed site.
const SITE = process.env.PUBLIC_SITE_URL ?? "https://connect-to-analytics-site.vercel.app/";
const dist = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), "utf8");

test("canonical, og:url and og:image use the deployed site", async () => {
  const html = await dist("index.html");
  for (const attr of [/rel="canonical" href="([^"]+)"/, /property="og:url" content="([^"]+)"/, /property="og:image" content="([^"]+)"/]) {
    const url = html.match(attr)?.[1];
    assert.ok(url?.startsWith(SITE), `${attr} -> ${url}`);
  }
});

test("sitemap and robots point at the deployed site", async () => {
  const files = (await readdir(new URL("../dist/", import.meta.url))).filter((f) => /^sitemap.*\.xml$/.test(f));
  assert.ok(files.length > 0);
  for (const file of files) {
    for (const [, loc] of (await dist(file)).matchAll(/<loc>([^<]+)<\/loc>/g)) assert.ok(loc.startsWith(SITE), `${file}: ${loc}`);
  }
  assert.match(await dist("robots.txt"), new RegExp(`Sitemap: ${SITE.replace(/[.]/g, "\\.")}sitemap-index\\.xml`));
});
