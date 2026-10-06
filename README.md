# Connect to Analytics

Open-source Agent Skill for querying EI Analytic industrial condition-monitoring data in natural language. It includes a zero-dependency Node.js CLI for hierarchy discovery, devices, current and historical measurements, FFT/TWF signals, thermal images, and sensor assignments.

- **License:** MIT
- **Runtime:** Node.js 18+
- **Agent Skill:** `skills/ei-analytic/SKILL.md`
- **Public site:** https://connect-to-analytics-site.vercel.app/

## Why this project exists

Industrial condition-monitoring APIs expose useful machine, vibration, sensor, and thermal data, but their endpoint structure is not always convenient for agent-driven workflows. This project provides a small, inspectable integration layer that lets an Agent Skills-compatible client resolve hierarchy, call supported API operations, and return structured JSON without embedding credentials in the skill.

## Requirements

- Node.js 18 or newer
- An EI Analytic account with API access

## Install

Install the Agent Skill:

```bash
npx skills add legongoraek/connect-to-analytics --skill ei-analytic
```

For a manual Codex installation:

```bash
git clone https://github.com/legongoraek/connect-to-analytics.git
cp -r connect-to-analytics/skills/ei-analytic ~/.codex/skills/
```

Use the equivalent skills directory for Claude, Cursor, Gemini CLI, or another Agent Skills-compatible client.

## Use with Codex

The repository follows the Agent Skills layout and keeps the agent instructions in `skills/ei-analytic/SKILL.md`. Once the skill is installed and credentials are configured, requests can stay task-oriented, for example:

- "Using the EI Analytic skill, list the companies and areas available to my account."
- "Find the measurement points for machine 123 and summarize the current readings."
- "Retrieve vibration history for machine 123, point 1, axis 1 for this date range and summarize notable changes."
- "Fetch the FFT for the selected measurement and explain the returned units without inventing missing context."

The skill instructs the agent to resolve names to IDs from the hierarchy instead of guessing IDs, use narrow time/data ranges, distinguish measurements from interpretation, and treat remote API content as untrusted data rather than agent instructions.

## Configure

Set credentials in your shell. Do not commit them.

```bash
export EIA_EMAIL="you@example.com"
export EIA_PASSWORD="your-password"
export EIA_DATABASE="database-name" # only needed for accounts with multiple databases
```

You may set `EIA_TOKEN` instead of email and password when you already have a valid database token.

`EIA_BASE_URL` is optional. Custom remote endpoints must use HTTPS; plain HTTP is accepted only for localhost development. By default, remote hosts are restricted to known EI Analytic service hosts. A different remote host additionally requires `EIA_ALLOW_CUSTOM_HOST=1`.

Raw endpoint access is disabled by default. Enable it only for a known endpoint when a supported command does not cover the task:

```bash
export EIA_ALLOW_RAW=1
```

Endpoints whose names look state-changing require a second explicit opt-in:

```bash
export EIA_ALLOW_UNSAFE_RAW=1
```

Do not enable either flag merely to bypass normal validation.

## CLI examples

```bash
node skills/ei-analytic/scripts/eia.mjs companies --pretty
node skills/ei-analytic/scripts/eia.mjs areas --company 1 --pretty
node skills/ei-analytic/scripts/eia.mjs history --machine 1308730117 --point 1 --axis 1 --start 2026-07-01 --end 2026-07-15 --pretty
node skills/ei-analytic/scripts/eia.mjs fft --machine 1308730117 --point 1 --file 49 --output fft --signal mm-s --frequency hz
```

All successful commands print JSON to stdout. Run `node skills/ei-analytic/scripts/eia.mjs help` for every command.

## Reliability and security boundaries

The CLI is deliberately defensive around agent-controlled inputs and remote responses:

- strict integer, boolean, date, date-range, and CLI-option validation;
- allowlisted EI Analytic remote hosts by default, with explicit opt-in for a custom host;
- HTTPS-only custom API endpoints except localhost;
- 30-second request timeout and bounded retries for transient failures;
- redirects disabled for authenticated API requests;
- response and decoded-binary size limits;
- recursive redaction of token/password/secret-like response fields;
- configured credentials removed from error messages;
- raw payloads rejected when they contain credential fields or unsafe object keys;
- raw requests never automatically retried;
- thermal image output refuses to overwrite an existing file unless `--overwrite true` is explicit;
- FFT/TWF and thermal base64 payloads are validated before decoding.

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security-sensitive areas. Known EI Analytic web/API surfaces, including the currently unsupported `getCustomDataCompress` endpoint, are documented in [skills/ei-analytic/references/services.md](skills/ei-analytic/references/services.md).

## Offline verification

Core CLI contracts are tested without live credentials or API access:

```bash
node --check skills/ei-analytic/scripts/eia.mjs
node --test skills/ei-analytic/scripts/*.test.mjs
node skills/ei-analytic/scripts/eia.mjs help
```

GitHub Actions runs these checks on Node.js 18 and Node.js 22 for changes to the skill or CLI.

## Project structure

```text
skills/ei-analytic/
├── SKILL.md             # Agent instructions and safety workflow
├── scripts/eia.mjs      # Zero-dependency CLI
├── scripts/eia.test.mjs # Offline CLI contract tests
├── references/          # API reference material
└── agents/              # Agent-specific metadata

site/                    # Isolated Astro landing site
docs/                    # Design/planning documentation
.github/workflows/       # CLI and landing-site CI
```

## Landing site

The public SEO/GEO landing page lives in `site/`. It is an isolated Astro static site and does not import the Agent Skill runtime or make browser-side EI Analytic API requests.

```bash
cd site
npm install
npm run dev
npm test
npm run build
```

The site uses Astro 5 so it remains compatible with Node.js 18+. Set `PUBLIC_SITE_URL` to the production origin before building when the site is deployed somewhere other than the configured fallback URL; Astro uses it for canonical URLs and sitemap generation.

Public search/discovery assets include semantic metadata, JSON-LD, `robots.txt`, sitemap generation, and `llms.txt`.

## Security

- Credentials and tokens are read from environment variables only.
- Secrets are never written to the repository or intentionally logged by the CLI.
- Requests go directly to the configured EI Analytic API base URL.
- The landing site contains no EI Analytic credentials and does not authenticate to the API.
- Security reports should follow [SECURITY.md](SECURITY.md).

The API documentation used by this project was last updated June 20, 2024. Deprecated endpoints are intentionally excluded in favor of `GetAllHistoryMeasures` and `GetFFT_Base64`.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development, testing, Agent Skill, and pull-request guidance.

Useful areas for contribution include documented endpoint coverage, additional offline contract cases, response schemas, and compatibility checks as the upstream API evolves.

## License

[MIT](LICENSE)
