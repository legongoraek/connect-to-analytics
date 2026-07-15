# EI Analytic API reference

Source: `ApiWeb.pdf`, last updated June 20, 2024. All endpoints use POST JSON under `https://api.eianalytic.com/ApiWeb.svc/`.

## Status envelope

Responses normally have the shape `[{"Key": {"StatusNumber": 0, "Description": "OK"}, "Value": ...}]`. The CLI exposes it as `{status: {number, description, configs}, data}`. Tabular responses containing `columns` and `data` are expanded to objects.

## Hierarchy and measurements

| CLI command | Endpoint | Required options |
| --- | --- | --- |
| `companies` | `GetCompanies` | none |
| `areas` | `GetAreas` | `--company` |
| `machines` | `GetMachines` | `--area` |
| `points` | `GetPoints` | `--machine` |
| `axes` | `GetAxis` | `--machine`, `--point` |
| `history` | `GetAllHistoryMeasures` | `--machine`, `--point`, `--axis`, `--start`, `--end`; optional `--rms` |
| `sensor-data` | `GetDataBySensor` | `--phantom`, `--start`, `--end` |
| `units` | `GetUnits` | none |
| `extra-values` | `GetExtraValues` | `--machine`, `--point`, `--unit`, `--start`, `--end` |
| `current` | `GetCurrentMeasures` | optional `--company`, `--area`, `--machine`, `--point`, `--axis` (defaults `-1`) |
| `all-current` | `GetAllCurrentMeasures` | optional `--since` |

## Devices and binary data

| CLI command | Endpoint | Required options |
| --- | --- | --- |
| `devices` | `GetDevices` | optional hierarchy filters, defaults `-1` |
| `devices-by-code` | `GetDevicesByCode` | `--codes` comma-separated |
| `all-devices` | `GetAllDevices` | none |
| `assignments` | `GetPhantomAssignedMachines` | optional `--code` |
| `fft` | `GetFFT_Base64` | `--machine`, `--point`, `--file`; optional boolean axis/output/signal/frequency |
| `thermo` | `GetThermoData` | `--machine`, `--point`, `--file`, `--output-file` |

FFT output types: `1` FFT, `2` TWF. Signal types: `0` G, `1` mm/s2, `2` mm/s, `3` in/s, `4` micrometers, `5` mils, `6` GE. The boolean `axis` option controls inclusion of the signal axis and defaults to true. The service's `hz` field is counterintuitive: `false` means Hz and `true` means CPM.

## Reason codes

| Code | Reason |
| ---: | --- |
| 1 | Requested |
| 2 | Scheduled |
| 3 | Alarm |
| 4 | Route |
| 5 | ManualData |
| 6 | SoftReset |
| 7 | internalRMS |
| 8 | SensorAlarm |
| 9 | OffRoute |
| 10 | SmallThermalImage |

All real values returned by `GetAllCurrentMeasures` are metric. Session tokens expire after 24 hours without activity.
