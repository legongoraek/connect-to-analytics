#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const BASE_URL = (process.env.EIA_BASE_URL || "https://api.eianalytic.com/ApiWeb.svc").replace(/\/$/, "");

const HELP = `EI Analytic CLI

Usage: node skills/ei-analytic/scripts/eia.mjs <command> [options] [--pretty]

Commands:
  login
  companies
  areas --company ID
  machines --area ID
  points --machine CODE
  axes --machine CODE --point INDEX
  history --machine CODE --point INDEX --axis N --start DATE --end DATE [--rms true|false]
  sensor-data --phantom CODE --start DATE --end DATE
  units
  extra-values --machine CODE --point INDEX --unit ID --start DATE --end DATE
  thermo --machine CODE --point INDEX --file ID --output-file PATH
  devices [--company ID] [--area ID] [--machine CODE] [--point INDEX]
  devices-by-code --codes CODE,CODE
  current [--company ID] [--area ID] [--machine CODE] [--point INDEX] [--axis N]
  all-current [--since "YYYY-MM-DD HH:mm:ss"]
  all-devices
  assignments [--code CODE]
  fft --machine CODE --point INDEX --file ID [--axis true|false] [--output fft|twf]
      [--signal g|mm-s2|mm-s|in-s|um|mils|ge] [--frequency hz|cpm]
  raw ENDPOINT [--data JSON]

Authentication: set EIA_TOKEN, or EIA_EMAIL and EIA_PASSWORD. If the account has
multiple databases, also set EIA_DATABASE to a database Name, DBName, or Id.`;

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    if (!part.startsWith("--")) { positional.push(part); continue; }
    const [rawKey, inline] = part.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (inline !== undefined) options[key] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) options[key] = argv[++i];
    else options[key] = true;
  }
  return { positional, options };
}

function required(options, ...keys) {
  for (const key of keys) if (options[key] === undefined) throw new Error(`Missing --${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`);
}

function int(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === true || value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected true or false, received ${value}`);
}

async function post(endpoint, payload) {
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`${endpoint} returned non-JSON (${response.status}): ${text.slice(0, 200)}`); }
  if (!response.ok) throw new Error(`${endpoint} failed with HTTP ${response.status}`);
  return json;
}

function expandTables(value) {
  if (Array.isArray(value)) return value.map(expandTables);
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value.columns) && Array.isArray(value.data)) {
    return value.data.map(row => Object.fromEntries(value.columns.map((column, i) => [column, row[i]])));
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandTables(item)]));
}

function normalize(json) {
  const envelope = Array.isArray(json) ? json[0] : json;
  if (!envelope || typeof envelope !== "object" || !("Key" in envelope)) return json;
  const key = envelope.Key || {};
  const expanded = expandTables(envelope.Value);
  const data = Array.isArray(expanded) && expanded.length === 1 && Array.isArray(expanded[0]) ? expanded[0] : expanded;
  const result = {
    status: { number: key.StatusNumber, description: key.Description, ...(key.Configs !== undefined ? { configs: key.Configs } : {}) },
    data,
  };
  if (key.StatusNumber !== 0) throw new Error(`EI Analytic ${key.StatusNumber}: ${key.Description || "unknown error"}`);
  return result;
}

async function login() {
  const email = process.env.EIA_EMAIL;
  const password = process.env.EIA_PASSWORD;
  if (!email || !password) throw new Error("Set EIA_EMAIL and EIA_PASSWORD, or provide EIA_TOKEN");
  return normalize(await post("Login", { email, password }));
}

function publicLoginResult(result) {
  return {
    ...result,
    data: Array.isArray(result.data)
      ? result.data.map(({ Token, ...item }) => ({ ...item, Token: Token ? "[REDACTED]" : undefined }))
      : result.data,
  };
}

async function token() {
  if (process.env.EIA_TOKEN) return process.env.EIA_TOKEN;
  const result = await login();
  const databases = Array.isArray(result.data) ? result.data : [];
  if (!databases.length) throw new Error("Login succeeded but returned no databases");
  const selector = process.env.EIA_DATABASE;
  let selected;
  if (selector) selected = databases.find(item => {
    const db = item.DataBase || {};
    return String(db.Id) === selector || db.Name === selector || db.DBName === selector;
  });
  else if (databases.length === 1) selected = databases[0];
  else throw new Error(`Multiple databases returned; set EIA_DATABASE to one of: ${databases.map(x => x.DataBase?.Name || x.DataBase?.DBName || x.DataBase?.Id).join(", ")}`);
  if (!selected?.Token) throw new Error("Selected database did not include a token");
  return selected.Token;
}

const commandMap = {
  companies: ["GetCompanies", () => ({})],
  areas: ["GetAreas", o => (required(o, "company"), { idcompany: int(o.company, "company") })],
  machines: ["GetMachines", o => (required(o, "area"), { idarea: int(o.area, "area") })],
  points: ["GetPoints", o => (required(o, "machine"), { machinecode: int(o.machine, "machine") })],
  axes: ["GetAxis", o => (required(o, "machine", "point"), { machinecode: int(o.machine, "machine"), pointindex: int(o.point, "point") })],
  history: ["GetAllHistoryMeasures", o => (required(o, "machine", "point", "axis", "start", "end"), { machinecode: int(o.machine, "machine"), pointindex: int(o.point, "point"), axis: int(o.axis, "axis"), StartDate: o.start, EndDate: o.end, getRMS: bool(o.rms, true) })],
  "sensor-data": ["GetDataBySensor", o => (required(o, "phantom", "start", "end"), { phantomCode: int(o.phantom, "phantom"), StartDate: o.start, EndDate: o.end })],
  units: ["GetUnits", () => ({})],
  "extra-values": ["GetExtraValues", o => (required(o, "machine", "point", "unit", "start", "end"), { machinecode: int(o.machine, "machine"), pointindex: int(o.point, "point"), unit: int(o.unit, "unit"), StartDate: o.start, EndDate: o.end })],
  devices: ["GetDevices", o => ({ companyId: int(o.company ?? -1, "company"), areaId: int(o.area ?? -1, "area"), machineCode: int(o.machine ?? -1, "machine"), pointIndex: int(o.point ?? -1, "point") })],
  "devices-by-code": ["GetDevicesByCode", o => (required(o, "codes"), { phantomCodes: o.codes })],
  current: ["GetCurrentMeasures", o => ({ companyID: int(o.company ?? -1, "company"), areaID: int(o.area ?? -1, "area"), machineCode: int(o.machine ?? -1, "machine"), pointIndex: int(o.point ?? -1, "point"), axis: int(o.axis ?? -1, "axis") })],
  "all-current": ["GetAllCurrentMeasures", o => ({ ...(o.since ? { dateTime: o.since } : {}) })],
  "all-devices": ["GetAllDevices", () => ({})],
  assignments: ["GetPhantomAssignedMachines", o => ({ code: o.code ?? "" })],
};

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  if (!command || command === "help" || options.help) { console.log(HELP); return; }
  if (command === "login") { console.log(JSON.stringify(publicLoginResult(await login()), null, options.pretty ? 2 : 0)); return; }

  let result;
  const authToken = await token();
  if (commandMap[command]) {
    const [endpoint, payload] = commandMap[command];
    result = normalize(await post(endpoint, { ...payload(options), Token: authToken }));
  } else if (command === "fft") {
    required(options, "machine", "point", "file");
    const outputTypes = { fft: 1, twf: 2 };
    const signalTypes = { g: 0, "mm-s2": 1, "mm-s": 2, "in-s": 3, um: 4, mils: 5, ge: 6 };
    const output = options.output ?? "fft";
    const signal = options.signal ?? "g";
    const frequency = options.frequency ?? "hz";
    if (!(output in outputTypes) || !(signal in signalTypes) || !["hz", "cpm"].includes(frequency)) throw new Error("Invalid FFT output, signal, or frequency option");
    result = normalize(await post("GetFFT_Base64", { OutputType: outputTypes[output], SignalTypeOut: signalTypes[signal], axis: bool(options.axis, true), fileid: int(options.file, "file"), hz: frequency === "cpm", machinecode: int(options.machine, "machine"), pointindex: int(options.point, "point"), Token: authToken }));
    const item = result.data;
    if (item?.base64) {
      const bytes = Buffer.from(item.base64, "base64");
      const values = [];
      for (let i = 0; i + 4 <= bytes.length; i += 4) values.push(bytes.readFloatLE(i));
      result.data = { ...item, values, base64: undefined };
    }
  } else if (command === "thermo") {
    required(options, "machine", "point", "file", "outputFile");
    const response = normalize(await post("GetThermoData", { fileID: int(options.file, "file"), machineCode: int(options.machine, "machine"), pointIndex: int(options.point, "point"), Token: authToken }));
    const encoded = Array.isArray(response.data) ? response.data[0] : response.data;
    if (typeof encoded !== "string") throw new Error("Thermal response did not contain a base64 image");
    const image = Buffer.from(encoded, "base64");
    await writeFile(options.outputFile, image);
    result = { status: response.status, data: { outputFile: options.outputFile, bytes: image.length } };
  } else if (command === "raw") {
    const endpoint = positional[1];
    if (!endpoint || !/^[A-Za-z][A-Za-z0-9_]*$/.test(endpoint)) throw new Error("raw requires a safe endpoint name");
    let data = {};
    if (options.data) { try { data = JSON.parse(options.data); } catch { throw new Error("--data must be valid JSON"); } }
    result = normalize(await post(endpoint, { ...data, Token: authToken }));
  } else throw new Error(`Unknown command: ${command}. Run help for usage.`);

  console.log(JSON.stringify(result, null, options.pretty ? 2 : 0));
}

main().catch(error => { console.error(`[eia] ${error.message}`); process.exitCode = 1; });
