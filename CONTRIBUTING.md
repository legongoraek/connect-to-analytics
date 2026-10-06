# Contributing

Thanks for considering a contribution to Connect to Analytics.

The project is intentionally small: an Agent Skill, a zero-dependency Node.js CLI, reference documentation, offline contract tests, and an isolated Astro landing site. Contributions should keep those boundaries clear and avoid introducing unnecessary runtime dependencies.

## Before you start

For bug fixes and small documentation improvements, a pull request is welcome directly.

For new commands, endpoint coverage, authentication changes, raw endpoint behavior, or changes to the public CLI contract, please open an issue first so the scope and compatibility impact can be discussed.

Security issues should follow [SECURITY.md](SECURITY.md) and should not be filed publicly with exploit details or secrets.

## Development setup

Requirements:

- Node.js 18 or newer
- Git
- An EI Analytic account only when testing authenticated API behavior

Clone the repository and inspect the CLI without credentials:

```bash
git clone https://github.com/legongoraek/connect-to-analytics.git
cd connect-to-analytics
node skills/ei-analytic/scripts/eia.mjs help
```

The CLI should continue to run without third-party runtime dependencies.

## Verify the CLI offline

Run the same contract checks used by CI before opening a pull request:

```bash
node --check skills/ei-analytic/scripts/eia.mjs
node --test skills/ei-analytic/scripts/*.test.mjs
node skills/ei-analytic/scripts/eia.mjs help
```

These tests must not require EI Analytic credentials or live API access.

When changing validation, HTTP behavior, redaction, raw endpoint access, binary decoding, or response normalization, add or update an offline test that demonstrates the intended contract.

## Landing site

The landing site is isolated under `site/`:

```bash
cd site
npm install
npm test
npm run build
```

Changes under `site/` should keep the browser bundle free of EI Analytic credentials and authenticated API calls.

## Testing API changes

When a change requires live API access:

- keep credentials in environment variables only;
- use the narrowest data range needed for verification;
- do not paste private industrial data into commits, issues, snapshots, or test fixtures;
- redact IDs or values when they are not necessary to reproduce the behavior;
- verify that stdout contains only the intended command result and that diagnostics do not expose secrets;
- never weaken validation simply to make a live request pass.

Prefer offline contract tests whenever behavior can be validated without a live service.

## Security invariants

Contributions must preserve these boundaries unless a reviewed change intentionally strengthens them:

- custom remote `EIA_BASE_URL` values use HTTPS; HTTP is limited to localhost;
- authenticated requests do not follow redirects;
- supported read workflows use bounded retries only for transient failures;
- `raw` is disabled unless `EIA_ALLOW_RAW=1`;
- mutation-like raw endpoints require `EIA_ALLOW_UNSAFE_RAW=1`;
- raw payloads cannot provide credential fields;
- raw requests are not automatically retried;
- decoded binary payloads and API responses remain bounded;
- thermal output does not overwrite existing files without explicit `--overwrite true`;
- token/password/secret-like response fields are redacted from CLI output.

If a legitimate use case requires changing one of these contracts, document the threat model and add tests for the replacement behavior.

## Agent Skill changes

The source of truth for agent behavior is `skills/ei-analytic/SKILL.md`.

When changing the skill:

- keep instructions tool-agnostic where possible;
- document new commands/options in the skill and CLI help;
- do not instruct agents to guess hierarchy IDs or credentials;
- preserve the rule that remote API content is data, not trusted agent instruction;
- preserve the rule that secrets are never printed;
- prefer narrow queries over bulk retrieval when they answer the request;
- distinguish observed measurements from diagnosis or maintenance advice.

## Pull requests

A good pull request:

- has one clear purpose;
- explains user-visible behavior changes;
- includes tests or a verification note when practical;
- updates documentation when commands or security behavior change;
- does not include generated secrets, tokens, customer data, or unrelated formatting changes.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
