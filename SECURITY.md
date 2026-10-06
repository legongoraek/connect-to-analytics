# Security Policy

## Supported version

Security fixes target the latest version of the `main` branch. Older snapshots, forks, and third-party repackaging are not maintained by this repository.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public GitHub issue.

If GitHub shows a private **Report a vulnerability** option for this repository, use it. Otherwise, contact the maintainer through the contact information on the maintainer's GitHub profile and share only enough information to establish a private reporting channel.

A useful report includes:

- the affected file, command, or workflow;
- the security impact and realistic attack scenario;
- reproduction steps or a minimal proof of concept;
- whether EI Analytic credentials, tokens, API responses, or local files may be exposed;
- a suggested mitigation, if known.

Please avoid including real credentials, production tokens, private industrial data, or customer data in a report.

## Security-sensitive areas

Changes in these areas deserve additional review:

- handling of `EIA_EMAIL`, `EIA_PASSWORD`, `EIA_TOKEN`, and `EIA_DATABASE`;
- API base URL and request construction;
- the `raw` command and user-supplied endpoint/data arguments;
- filesystem writes such as thermal-image output;
- parsing and normalization of remote API responses;
- CI workflows and dependency updates for the public landing site.

## Secret handling

The CLI reads authentication material from environment variables. Secrets must never be committed, printed to normal output, embedded in fixtures, or added to the public landing site.

The repository ignores `.env` and `.env.*` files. Contributors should use redacted or synthetic data in tests, examples, issues, and pull requests.

## Scope

This project is an independent open-source integration. A vulnerability in the upstream EI Analytic service itself should be reported to the service owner rather than published here.
