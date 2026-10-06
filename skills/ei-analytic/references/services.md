# EI Analytic service boundaries

This repository intentionally distinguishes the EI Analytic browser application from the service endpoints used by the CLI.

## Known surfaces

| Surface | URL | Repository status |
| --- | --- | --- |
| Browser application | `https://app.eianalytic.com/` | User-facing web application. Not used as an API base by the CLI. |
| ApiWeb service | `https://api.eianalytic.com/ApiWeb.svc` | Supported primary service. The documented CLI commands in `eia.mjs` target this service. |
| Waveform/custom-data service | `https://eiawswv.eianalytic.com/Service1.svc/getCustomDataCompress` | Known secondary endpoint. Its request/response contract is not documented in this repository yet, so it is not exposed as a supported CLI command. |

## Trust policy

The CLI trusts the known EI Analytic service hosts `api.eianalytic.com` and `eiawswv.eianalytic.com`, plus localhost for development.

A different remote host requires the explicit environment opt-in:

```text
EIA_ALLOW_CUSTOM_HOST=1
```

This flag only relaxes the hostname check. It does not relax HTTPS, endpoint-name validation, credential redaction, response-size limits, or raw-endpoint controls.

## Secondary custom-data endpoint

Do not infer the payload for `getCustomDataCompress` from its name.

Before adding a first-class CLI command for it, capture and document:

- HTTP method;
- required request fields;
- authentication/token field and semantics;
- content type;
- compressed response framing/encoding;
- decompression algorithm;
- maximum expected response size;
- error response format;
- whether a request is read-only and idempotent.

Until that contract is verified, agents should use the existing documented `ApiWeb.svc` commands and must not fabricate a request to the secondary service.

## Adding support

When the secondary contract is available:

1. add the contract to this reference file;
2. implement a dedicated command rather than relying on `raw`;
3. isolate decompression from interpretation;
4. apply compressed and decompressed size limits;
5. add offline fixtures/tests with synthetic data;
6. verify no token, credential, or private industrial content is logged;
7. document the new command in `SKILL.md`, `README.md`, and `references/api.md`.
