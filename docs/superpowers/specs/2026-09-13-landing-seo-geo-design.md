# Connect to Analytics Landing + SEO/GEO Design

## Goal

Add a public, search-optimized landing site for Connect to Analytics without changing the existing `skills/ei-analytic` Agent Skill or its CLI behavior.

## Current repository

The repository is currently an Agent Skill package for querying EI Analytic industrial condition-monitoring data. It includes a zero-dependency Node.js CLI and documentation, but no frontend application. The existing skill remains the functional core and must stay independently usable.

## Architecture

Create a new Astro static site under `site/` and keep `skills/ei-analytic/` isolated. The website is a presentation/discovery layer only: it documents the product, explains use cases, links to installation/source, and publishes structured content for search engines and generative answer engines.

The site must not import runtime code from the CLI and must not require EI Analytic credentials to build or render.

## Routes

### `/`

Primary landing page containing:

1. Header/navigation
2. Hero with product proposition and primary GitHub CTA
3. Problem/solution section
4. Capabilities section covering hierarchy discovery, devices, current/historical measurements, FFT/TWF, thermal images, extra sensor values, and sensor assignments
5. Workflow explaining `Natural language → Agent → EI Analytic API → Industrial data`
6. Realistic prompt/query examples
7. Industrial use cases
8. Agent compatibility section
9. Security section explaining environment-variable credential handling
10. Installation section
11. FAQ optimized for direct-answer retrieval
12. Final CTA/footer

The page must use semantic headings and meaningful anchors so sections can be directly referenced by search engines and AI systems.

## Visual direction

Use a clean industrial/developer-tool presentation rather than a documentation theme. The interface should feel technical and trustworthy, with strong typography, restrained visual effects, cards for capabilities, code/query examples, and an explicit data-flow visualization.

The page must be responsive for mobile, tablet, and desktop and should remain understandable without client-side JavaScript.

## SEO

Implement:

- Descriptive `<title>` and meta description
- Canonical URL support through Astro `site` configuration
- Open Graph metadata
- Twitter/X card metadata
- Semantic HTML structure
- Search-friendly heading hierarchy
- `robots.txt`
- generated `sitemap.xml`
- favicon/manifest metadata where appropriate
- crawlable static content
- descriptive internal anchors

Use `@astrojs/sitemap` for sitemap generation. The site should be deployable to Vercel, Netlify, or GitHub Pages without coupling the repository to one hosting provider.

## GEO / Generative Engine Optimization

Optimize the public content so answer engines can correctly identify:

- what Connect to Analytics is
- that it provides an Agent Skill for EI Analytic
- which industrial data categories it can query
- how agents interact with the EI Analytic API through the CLI
- supported agent/client environments
- installation requirements
- security/credential model

Implement structured, direct-answer sections and machine-readable metadata:

- JSON-LD `SoftwareApplication`
- JSON-LD `WebSite`
- JSON-LD `FAQPage`
- `/llms.txt` summarizing the project, capabilities, installation, repository URL, and important public routes

Do not make unsupported claims such as official affiliation, guaranteed AI ranking, certification, performance guarantees, or capabilities not implemented by the Agent Skill.

## Content truth source

Public copy must remain consistent with the current repository documentation and `skills/ei-analytic/SKILL.md`. Specifically, supported capabilities include companies, areas, machines, points, axes, devices, current and historical measurements, sensor data, extra values, assignments, FFT/TWF signals, and thermal images.

Credentials remain environment-only:

- `EIA_EMAIL`
- `EIA_PASSWORD`
- `EIA_DATABASE` (optional when account/database selection permits)
- `EIA_TOKEN` (optional existing database token)
- `EIA_BASE_URL` (optional API base URL)

No credentials or secret values may be embedded in the site.

## File structure

```text
site/
  astro.config.mjs
  package.json
  tsconfig.json
  public/
    favicon.svg
    robots.txt
    llms.txt
  src/
    components/
      CapabilityCard.astro
      CodeExample.astro
      FAQ.astro
      Footer.astro
      Header.astro
      Workflow.astro
    layouts/
      BaseLayout.astro
    pages/
      index.astro
    styles/
      global.css
```

Root-level project documentation should be updated to explain how to run/build the site while preserving the existing Agent Skill installation instructions.

## Testing and acceptance criteria

The implementation is complete when:

1. `npm install` in `site/` resolves dependencies.
2. `npm run build` in `site/` completes successfully.
3. The generated output contains the landing page, robots file, llms file, and sitemap.
4. The landing is responsive and does not depend on client-side JavaScript for core content.
5. Page source contains canonical, description, Open Graph, Twitter card, and JSON-LD metadata.
6. Heading hierarchy contains a single clear H1 and logical H2/H3 sections.
7. All public capability statements match the existing Agent Skill documentation.
8. Existing `skills/ei-analytic` files and CLI behavior remain unchanged.
9. No credential values are committed or rendered.
10. README documents both the Agent Skill and landing-site development workflow.

## Non-goals

- No authenticated dashboard
- No live EI Analytic API calls from the browser
- No user account system
- No analytics vendor integration in this phase
- No documentation portal in this phase
- No changes to the existing CLI/API contract
