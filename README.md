# ai-skill-ei-analytic

Agent Skill for querying EI Analytic industrial condition-monitoring data in natural language. It includes a zero-dependency Node.js CLI for hierarchy discovery, devices, current and historical measurements, FFT/TWF signals, thermal images, and sensor assignments.

## Requirements

- Node.js 18 or newer
- An EI Analytic account with API access

## Install

```bash
npx skills add <owner>/ai-skill-ei-analytic --skill ei-analytic
```

For a manual installation:

```bash
git clone <repository-url> ai-skill-ei-analytic
cp -r ai-skill-ei-analytic/skills/ei-analytic ~/.codex/skills/
```

Use the equivalent skills directory for Claude, Cursor, Gemini CLI, or another Agent Skills-compatible client.

## Configure

Set credentials in your shell. Do not commit them.

```bash
export EIA_EMAIL="you@example.com"
export EIA_PASSWORD="your-password"
export EIA_DATABASE="database-name" # only needed for accounts with multiple databases
```

You may set `EIA_TOKEN` instead of email and password when you already have a valid database token.

## CLI examples

```bash
node skills/ei-analytic/scripts/eia.mjs companies --pretty
node skills/ei-analytic/scripts/eia.mjs areas --company 1 --pretty
node skills/ei-analytic/scripts/eia.mjs history --machine 1308730117 --point 1 --axis 1 --start 2026-07-01 --end 2026-07-15 --pretty
node skills/ei-analytic/scripts/eia.mjs fft --machine 1308730117 --point 1 --file 49 --output fft --signal mm-s --frequency hz
```

All successful commands print JSON to stdout. Run `node skills/ei-analytic/scripts/eia.mjs help` for every command.

## Security

- Credentials and tokens are read from environment variables only.
- Secrets are never written to the repository or logged by the CLI.
- Requests go directly to the configured EI Analytic API base URL.

The API documentation used by this project was last updated June 20, 2024. Deprecated endpoints are intentionally excluded in favor of `GetAllHistoryMeasures` and `GetFFT_Base64`.

## License

MIT
