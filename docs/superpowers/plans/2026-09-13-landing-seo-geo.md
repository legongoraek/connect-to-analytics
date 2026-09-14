# Connect to Analytics Landing + SEO/GEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public Astro landing site for Connect to Analytics with complete technical SEO and GEO while preserving the existing EI Analytic Agent Skill and CLI unchanged.

**Architecture:** Create an isolated static Astro application under `site/`. The site consumes no CLI runtime code and needs no EI Analytic credentials. SEO/GEO are rendered at build time through semantic HTML, metadata, JSON-LD, sitemap, robots.txt, and llms.txt.

**Tech Stack:** Astro 5, TypeScript, @astrojs/sitemap, Node.js 18+, static HTML/CSS.

**Spec:** `docs/superpowers/specs/2026-09-13-landing-seo-geo-design.md`

## Global Constraints

- Existing `skills/ei-analytic/` behavior and files must remain unchanged.
- The site must not require EI Analytic credentials to build or render.
- Public claims must match README.md and `skills/ei-analytic/SKILL.md`.
- Credentials are environment-only and no secret values may be committed.
- Core landing content must work without client-side JavaScript.
- Do not claim official EI Analytic affiliation, guaranteed ranking, certification, or unsupported capabilities.

---

### Task 1: Astro static site foundation and metadata tests

**Files:**
- Create: `site/package.json`
- Create: `site/astro.config.mjs`
- Create: `site/tsconfig.json`
- Create: `site/tests/site.test.mjs`
- Create: `site/src/layouts/BaseLayout.astro`
- Create: `site/src/styles/global.css`

**Interfaces:**
- Consumes: Node.js 18+ and Astro build tooling.
- Produces: `npm run build` and `npm test`; reusable `BaseLayout` with `title`, `description`, and structured-data support.

- [ ] **Step 1: Write static source-contract tests**

Create `site/tests/site.test.mjs` using `node:test` and `node:assert/strict`. Assert that `src/pages/index.astro` has exactly one `<h1`, required section anchors, and that `BaseLayout.astro` contains canonical, description, Open Graph, Twitter card, and JSON-LD rendering markers. Assert `public/robots.txt` and `public/llms.txt` exist and include expected directives/project name.

- [ ] **Step 2: Run tests to verify they fail before the implementation exists**

Run: `cd site && npm test`
Expected: FAIL because the target source/public files do not exist yet.

- [ ] **Step 3: Add Astro build configuration**

Create `package.json` with scripts `dev`, `build`, `preview`, `test`; dependencies `astro` and `@astrojs/sitemap`; set `type` to `module`. Configure `astro.config.mjs` for static output, sitemap integration, and `site` sourced from `PUBLIC_SITE_URL` with a safe public fallback. Extend `astro/tsconfigs/strict` in `tsconfig.json`.

- [ ] **Step 4: Add `BaseLayout.astro` and global CSS foundation**

`BaseLayout.astro` must render `<html lang="en">`, title, meta description, canonical, robots, Open Graph, Twitter card, favicon/manifest links, and a JSON-LD script fed from page data. Import `global.css`. Global CSS must define responsive typography, layout variables, accessible focus styles, card/grid primitives, code blocks, and reduced-motion behavior without client JavaScript.

- [ ] **Step 5: Install and run the build once page files are present**

Run after Task 2: `cd site && npm install && npm run build`.
Expected: Astro static build succeeds.

- [ ] **Step 6: Commit**

```bash
git add site/package.json site/astro.config.mjs site/tsconfig.json site/tests/site.test.mjs site/src/layouts/BaseLayout.astro site/src/styles/global.css
git commit -m "feat: add Astro landing foundation"
```

### Task 2: Landing components, page content, SEO and GEO

**Files:**
- Create: `site/src/components/Header.astro`
- Create: `site/src/components/CapabilityCard.astro`
- Create: `site/src/components/CodeExample.astro`
- Create: `site/src/components/Workflow.astro`
- Create: `site/src/components/FAQ.astro`
- Create: `site/src/components/Footer.astro`
- Create: `site/src/pages/index.astro`
- Create: `site/public/favicon.svg`
- Create: `site/public/site.webmanifest`
- Create: `site/public/robots.txt`
- Create: `site/public/llms.txt`

**Interfaces:**
- Consumes: `BaseLayout.astro` and CSS primitives from Task 1.
- Produces: complete static `/` landing page, machine-readable metadata, public crawler files, and sitemap input.

- [ ] **Step 1: Implement navigation and hero**

Create semantic header/nav anchors for `#capabilities`, `#workflow`, `#examples`, `#security`, `#install`, and `#faq`. Hero copy must identify Connect to Analytics as an Agent Skill for querying EI Analytic industrial condition-monitoring data using natural-language-capable agents and a zero-dependency Node.js CLI. Primary CTA links to `https://github.com/legongoraek/connect-to-analytics`.

- [ ] **Step 2: Implement capability and workflow components**

Capabilities must cover companies, areas, machines, points, axes, devices, current measurements, historical measurements, sensor data, extra values, assignments, FFT/TWF signals, and thermal images. Workflow renders the explicit static sequence `Natural language → Agent → EI Analytic CLI → EI Analytic API → Industrial data`.

- [ ] **Step 3: Implement examples, use cases, compatibility, security, and install**

Use realistic natural-language examples corresponding to hierarchy discovery, history, FFT, thermal image, and assignments. State compatibility generically with Agent Skills-compatible clients and name Codex, Claude, Cursor, and Gemini CLI only as environments documented by the repository. Security copy must state that `EIA_EMAIL`, `EIA_PASSWORD`, `EIA_DATABASE`, `EIA_TOKEN`, and `EIA_BASE_URL` are environment variables and are not browser credentials.

- [ ] **Step 4: Implement FAQ and JSON-LD**

Create direct-answer FAQ entries explaining what the project is, what data it supports, credential handling, Node.js requirement, whether the browser calls the EI Analytic API, and whether the project changes the existing CLI. Build JSON-LD with `SoftwareApplication`, `WebSite`, and `FAQPage` objects and pass it to `BaseLayout`.

- [ ] **Step 5: Add crawler/GEO public files**

`robots.txt` must allow crawling and point to `/sitemap-index.xml`. `llms.txt` must summarize the project, supported capabilities, Node.js 18+ requirement, installation, security model, repository URL, and `/` public route. Add lightweight SVG favicon and web manifest.

- [ ] **Step 6: Run source-contract tests**

Run: `cd site && npm test`
Expected: PASS for one H1, anchors, metadata, robots, llms, JSON-LD markers, and capability truth-source checks.

- [ ] **Step 7: Build static site**

Run: `cd site && npm run build`
Expected: PASS; `dist/index.html`, `dist/robots.txt`, `dist/llms.txt`, and sitemap output exist.

- [ ] **Step 8: Commit**

```bash
git add site/src site/public
git commit -m "feat: add landing page with SEO and GEO"
```

### Task 3: README integration and final verification

**Files:**
- Modify: `README.md`
- Test: `site/tests/site.test.mjs`

**Interfaces:**
- Consumes: completed static site from Tasks 1-2.
- Produces: developer documentation for both Agent Skill and landing site plus final acceptance verification.

- [ ] **Step 1: Extend README without removing Agent Skill instructions**

Add a `Landing site` section explaining that the public website lives in `site/`, requires Node.js 18+, and is started/built with:

```bash
cd site
npm install
npm run dev
npm test
npm run build
```

Document `PUBLIC_SITE_URL` as the optional canonical deployment URL and state that the website makes no browser-side EI Analytic API requests.

- [ ] **Step 2: Run complete tests**

Run: `cd site && npm test`
Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `cd site && npm run build`
Expected: PASS.

- [ ] **Step 4: Inspect generated output**

Verify `dist/index.html` has one H1, canonical URL, description, Open Graph, Twitter card, and JSON-LD for `SoftwareApplication`, `WebSite`, and `FAQPage`. Verify `dist/robots.txt`, `dist/llms.txt`, and sitemap output. Verify no `EIA_EMAIL`, `EIA_PASSWORD`, or secret values are rendered.

- [ ] **Step 5: Verify Agent Skill isolation**

Run `git diff --name-only <pre-implementation-sha>..HEAD -- skills/ei-analytic`.
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add README.md site/tests/site.test.mjs
git commit -m "docs: document landing development workflow"
```

## Self-review

- Spec coverage: landing structure, Astro isolation, SEO metadata, sitemap, robots, GEO copy, JSON-LD, llms.txt, security model, responsive static content, README workflow, and CLI isolation are each mapped to tasks above.
- Placeholder scan: no deferred TODO/TBD implementation steps remain.
- Interface consistency: all site metadata flows through `BaseLayout`; all page copy is static and CLI-independent; tests reference only files defined by Tasks 1-2.
