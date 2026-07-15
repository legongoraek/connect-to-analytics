---
name: ei-analytic
description: Query EI Analytic industrial condition-monitoring data through its ApiWeb service. Use when an agent needs EI Analytic companies, areas, machines, measurement points, axes, devices, current or historical measurements, FFT/TWF signals, thermal images, extra sensor values, or sensor assignments from natural-language requests.
---

# EI Analytic

Use `node skills/ei-analytic/scripts/eia.mjs <command> [options]` from the repository root. Commands emit JSON to stdout and diagnostics to stderr.

## Authenticate

Read credentials only from environment variables:

```text
EIA_EMAIL
EIA_PASSWORD
EIA_DATABASE     optional database Name, DBName, or Id
EIA_TOKEN        optional existing database token; skips login
EIA_BASE_URL     optional API base URL
```

Never print credentials. Prefer `EIA_TOKEN` when provided. Otherwise the CLI logs in for each invocation and selects the only database automatically. If login returns multiple databases, require `EIA_DATABASE`.

## Choose commands

Run `node skills/ei-analytic/scripts/eia.mjs help` for the complete command and option list.

- Discover hierarchy with `companies`, `areas`, `machines`, `points`, and `axes`.
- Read measurements with `current`, `all-current`, `history`, `sensor-data`, and `extra-values`.
- Read hardware with `devices`, `all-devices`, `devices-by-code`, and `assignments`.
- Retrieve signals with `fft`; use `--output fft|twf`, `--signal g|mm-s2|mm-s|in-s|um|mils|ge`, and `--frequency hz|cpm`.
- Retrieve a thermal image with `thermo --output-file <path>`; the CLI writes the decoded image and returns metadata.
- Use `raw <Endpoint> --data '<json>'` only for undocumented or newly added endpoints.

Pass dates as `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss`. Resolve names to numeric IDs by querying the hierarchy first; do not guess IDs. Use `-1` only where the API documents it as an all-items wildcard.

## Interpret results

The CLI normalizes the service envelope to `{status, data}` and converts `{columns, data}` tables into arrays of named objects. Treat a nonzero `status.number` as an API failure. Explain unit and reason codes with [references/api.md](references/api.md).

For large results, query the narrowest date and hierarchy range that answers the request. Summarize findings in natural language and include the relevant machine, point, axis, timestamps, values, and units.

Do not use deprecated `GetHistoryMeasures` or `GetFFT`; the CLI uses `GetAllHistoryMeasures` and `GetFFT_Base64`.
