#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://api.eianalytic.com/ApiWeb.svc";
const HTTP_TIMEOUT_MS = 30_000;
const HTTP_RETRIES = 2;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_RAW_JSON_BYTES = 64 * 1024;
const MAX_BINARY_BYTES = 64 * 1024 * 1024;
const TRANSIENT_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const SENSITIVE_KEY = /(?:token|password|secret|authorization|api[-_]?key|credential)/i;
const RAW_READ_PREFIX = /^(?:get|list|read|fetch|query|search|download)/i;
const TRUSTED_REMOTE_HOSTS = new Set(["api.eianalytic.com", "eiawswv.eianalytic.com"]);

const HELP = [
  "EI Analytic CLI",
  "",
  "Usage: node skills/ei-analytic/scripts/eia.mjs <command> [options] [--pretty]",
  "",
  "Commands:",
  "  login",
  "  companies",
  "  areas --company ID",
  "  machines --area ID",
  "  points --machine CODE",
  "  axes --machine CODE --point INDEX",
  "  history --machine CODE --point INDEX --axis N --start DATE --end DATE [--rms true|false]",
  "  sensor-data --phantom CODE --start DATE --end DATE",
  "  units",
  "  extra-values --machine CODE --point INDEX --unit ID --start DATE --end DATE",
  "  thermo --machine CODE --point INDEX --file ID --output-file PATH [--overwrite true|false]",
  "  devices [--company ID] [--area ID] [--machine CODE] [--point INDEX]",
  "  devices-by-code --codes CODE,CODE",
  "  current [--company ID] [--area ID] [--machine CODE] [--point INDEX] [--axis N]",
  "  all-current [--since \"YYYY-MM-DD HH:mm:ss\"]",
  "  all-devices",
  "  assignments [--code CODE]",
  "  fft --machine CODE --point INDEX --file ID [--axis true|false] [--output fft|twf]",
  "      [--signal g|mm-s2|mm-s|in-s|um|mils|ge] [--frequency hz|cpm]",
  "  raw ENDPOINT [--data JSON]",
  "",
  "Authentication: set EIA_TOKEN, or EIA_EMAIL and EIA_PASSWORD. If the account has",
  "multiple databases, also set EIA_DATABASE to a database Name, DBName, or Id.",
  "",
  "Security: raw endpoint access is disabled unless EIA_ALLOW_RAW=1. Endpoint names",
  "that look state-changing also require EIA_ALLOW_UNSAFE_RAW=1."
].join("\n");

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    if (!part.startsWith("--")) {
      positional.push(part);
      continue;
    }

    const [rawKey, inline] = part.slice(2).split(/=(.*)/s, 2);
    if (!rawKey) throw new Error("Option name cannot be empty");
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      throw new Error("Duplicate option --" + rawKey);
    }

    if (inline !== undefined) options[key] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) options[key] = argv[++i];
    else options[key] = true;
  }

  return { positional, options };
}

function required(options, ...keys) {
  for (const key of keys) {
    if (options[key] === undefined) {
      const flag = key.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
      throw new Error("Missing --" + flag);
    }
  }
}

function int(value, name) {
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) throw new Error(name + " must be an integer");
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) throw new Error(name + " must be a safe integer");
  return parsed;
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error("Expected true or false, received " + String(value));
}

function safeText(value, name, maxLength = 2048) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new Error(name + " is too long");
  if (/[\u0000-\u001F\u007F]/.test(text)) throw new Error(name + " contains control characters");
  return text;
}

function parseDateValue(value, name) {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/.exec(text);
  if (!match) throw new Error(name + " must use YYYY-MM-DD or YYYY-MM-DD HH:mm:ss");

  const [, y, mo, d, h = "00", mi = "00", s = "00"] = match;
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new Error(name + " is not a valid calendar date");
  }

  return {
    text: text.includes("T") ? text.replace("T", " ") : text,
    epochMs: date.getTime(),
  };
}

function dateRange(start, end) {
  const parsedStart = parseDateValue(start, "start");
  const parsedEnd = parseDateValue(end, "end");
  if (parsedStart.epochMs > parsedEnd.epochMs) throw new Error("start must be before or equal to end");
  return { start: parsedStart.text, end: parsedEnd.text };
}

function getBaseUrl(env = process.env) {
  const raw = String(env.EIA_BASE_URL || DEFAULT_BASE_URL).trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("EIA_BASE_URL must be a valid URL");
  }

  if (url.username || url.password) throw new Error("EIA_BASE_URL must not contain credentials");

  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) {
    throw new Error("EIA_BASE_URL must use HTTPS; HTTP is allowed only for localhost");
  }

  const trustedRemote = TRUSTED_REMOTE_HOSTS.has(url.hostname.toLowerCase());
  if (!localHost && !trustedRemote && !envEnabled(env.EIA_ALLOW_CUSTOM_HOST)) {
    throw new Error("EIA_BASE_URL host is not trusted; set EIA_ALLOW_CUSTOM_HOST=1 only for an intentional custom host");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function endpointUrl(endpoint, env = process.env) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(endpoint)) throw new Error("Unsafe API endpoint name");
  return getBaseUrl(env) + "/" + endpoint;
}

function sleep(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, ms));
}

function retryDelayMs(response, attempt) {
  const raw = response?.headers?.get?.("retry-after");
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5000);

    const at = Date.parse(raw);
    if (Number.isFinite(at)) return Math.max(0, Math.min(at - Date.now(), 5000));
  }

  return Math.min(250 * (2 ** attempt), 2000);
}

function isRetryableNetworkError(error) {
  return error instanceof TypeError || error?.name === "AbortError" || error?.name === "TimeoutError";
}

async function readLimitedText(response, maxBytes = MAX_RESPONSE_BYTES) {
  const header = response.headers?.get?.("content-length");
  if (header !== null && header !== undefined && header !== "") {
    const length = Number(header);
    if (Number.isFinite(length) && length > maxBytes) throw new Error("API response exceeds safety limit");
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error("API response exceeds safety limit");
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      throw new Error("API response exceeds safety limit");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, total).toString("utf8");
}

async function post(endpoint, payload, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = HTTP_TIMEOUT_MS,
  retries = HTTP_RETRIES,
  retryable = true,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Fetch API is unavailable");

  const url = endpointUrl(endpoint, env);
  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
        },
        body,
        signal: controller.signal,
        redirect: "error",
      });

      if (retryable && attempt < retries && TRANSIENT_HTTP_STATUS.has(response.status)) {
        try { await response.body?.cancel?.(); } catch {}
        await sleep(retryDelayMs(response, attempt));
        continue;
      }

      if (!response.ok) throw new Error(endpoint + " failed with HTTP " + response.status);

      const responseText = await readLimitedText(response);
      try {
        return JSON.parse(responseText);
      } catch {
        throw new Error(endpoint + " returned non-JSON with HTTP " + response.status);
      }
    } catch (error) {
      if (!retryable || attempt >= retries || !isRetryableNetworkError(error)) throw error;
      await sleep(Math.min(250 * (2 ** attempt), 2000));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(endpoint + " request failed");
}

function expandTables(value) {
  if (Array.isArray(value)) return value.map(expandTables);
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value.columns) && Array.isArray(value.data)) {
    return value.data.map(row => {
      if (!Array.isArray(row)) throw new Error("Malformed table row in API response");
      return Object.fromEntries(value.columns.map((column, i) => [String(column), row[i]]));
    });
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandTables(item)]));
}

function cleanRemoteText(value, maxLength = 300) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .slice(0, maxLength);
}

function normalize(json) {
  const envelope = Array.isArray(json) ? json[0] : json;
  if (!envelope || typeof envelope !== "object" || !("Key" in envelope)) return json;

  const key = envelope.Key || {};
  const expanded = expandTables(envelope.Value);
  const data = Array.isArray(expanded) && expanded.length === 1 && Array.isArray(expanded[0])
    ? expanded[0]
    : expanded;

  const statusNumber = Number(key.StatusNumber);
  const result = {
    status: {
      number: Number.isFinite(statusNumber) ? statusNumber : key.StatusNumber,
      description: cleanRemoteText(key.Description),
      ...(key.Configs !== undefined ? { configs: key.Configs } : {}),
    },
    data,
  };

  if (statusNumber !== 0) {
    throw new Error("EI Analytic " + String(key.StatusNumber) + ": " + (cleanRemoteText(key.Description) || "unknown error"));
  }

  return result;
}

function redactText(value, env = process.env) {
  let text = String(value ?? "");

  for (const key of ["EIA_EMAIL", "EIA_PASSWORD", "EIA_DATABASE", "EIA_TOKEN"]) {
    const secret = env[key];
    if (secret) text = text.split(String(secret)).join("[REDACTED]");
  }

  text = text
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/((?:^|[?&\s])(?:token|password|secret|api[_-]?key)=)[^&\s]+/gi, "$1[REDACTED]");

  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function sanitizeOutput(value) {
  if (Array.isArray(value)) return value.map(sanitizeOutput);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (SENSITIVE_KEY.test(key) && item !== undefined && item !== null && item !== "") {
      return [key, "[REDACTED]"];
    }
    return [key, sanitizeOutput(item)];
  }));
}

async function login(env = process.env) {
  const email = env.EIA_EMAIL;
  const password = env.EIA_PASSWORD;
  if (!email || !password) throw new Error("Set EIA_EMAIL and EIA_PASSWORD, or provide EIA_TOKEN");
  return normalize(await post("Login", { email, password }, { env }));
}

async function token(env = process.env) {
  if (env.EIA_TOKEN) return env.EIA_TOKEN;

  const result = await login(env);
  const databases = Array.isArray(result.data) ? result.data : [];
  if (!databases.length) throw new Error("Login succeeded but returned no databases");

  const selector = env.EIA_DATABASE;
  let selected;

  if (selector) {
    selected = databases.find(item => {
      const db = item.DataBase || {};
      return String(db.Id) === selector || db.Name === selector || db.DBName === selector;
    });
    if (!selected) throw new Error("EIA_DATABASE did not match a database returned by login");
  } else if (databases.length === 1) {
    selected = databases[0];
  } else {
    throw new Error("Multiple databases returned; set EIA_DATABASE to a database Name, DBName, or Id");
  }

  if (!selected?.Token) throw new Error("Selected database did not include a token");
  return selected.Token;
}

function rangePayload(options) {
  const range = dateRange(options.start, options.end);
  return { StartDate: range.start, EndDate: range.end };
}

const commandMap = {
  companies: ["GetCompanies", () => ({})],
  areas: ["GetAreas", o => (required(o, "company"), { idcompany: int(o.company, "company") })],
  machines: ["GetMachines", o => (required(o, "area"), { idarea: int(o.area, "area") })],
  points: ["GetPoints", o => (required(o, "machine"), { machinecode: int(o.machine, "machine") })],
  axes: ["GetAxis", o => (required(o, "machine", "point"), {
    machinecode: int(o.machine, "machine"),
    pointindex: int(o.point, "point"),
  })],
  history: ["GetAllHistoryMeasures", o => {
    required(o, "machine", "point", "axis", "start", "end");
    return {
      machinecode: int(o.machine, "machine"),
      pointindex: int(o.point, "point"),
      axis: int(o.axis, "axis"),
      ...rangePayload(o),
      getRMS: bool(o.rms, true),
    };
  }],
  "sensor-data": ["GetDataBySensor", o => {
    required(o, "phantom", "start", "end");
    return {
      phantomCode: int(o.phantom, "phantom"),
      ...rangePayload(o),
    };
  }],
  units: ["GetUnits", () => ({})],
  "extra-values": ["GetExtraValues", o => {
    required(o, "machine", "point", "unit", "start", "end");
    return {
      machinecode: int(o.machine, "machine"),
      pointindex: int(o.point, "point"),
      unit: int(o.unit, "unit"),
      ...rangePayload(o),
    };
  }],
  devices: ["GetDevices", o => ({
    companyId: int(o.company ?? -1, "company"),
    areaId: int(o.area ?? -1, "area"),
    machineCode: int(o.machine ?? -1, "machine"),
    pointIndex: int(o.point ?? -1, "point"),
  })],
  "devices-by-code": ["GetDevicesByCode", o => {
    required(o, "codes");
    return { phantomCodes: safeText(o.codes, "codes") };
  }],
  current: ["GetCurrentMeasures", o => ({
    companyID: int(o.company ?? -1, "company"),
    areaID: int(o.area ?? -1, "area"),
    machineCode: int(o.machine ?? -1, "machine"),
    pointIndex: int(o.point ?? -1, "point"),
    axis: int(o.axis ?? -1, "axis"),
  })],
  "all-current": ["GetAllCurrentMeasures", o => ({
    ...(o.since ? { dateTime: parseDateValue(o.since, "since").text } : {}),
  })],
  "all-devices": ["GetAllDevices", () => ({})],
  assignments: ["GetPhantomAssignedMachines", o => ({
    code: o.code === undefined ? "" : safeText(o.code, "code", 256),
  })],
};

function decodeBase64(value, name, maxBytes = MAX_BINARY_BYTES) {
  if (typeof value !== "string") throw new Error(name + " did not contain base64 data");

  const clean = value.replace(/\s+/g, "");
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new Error(name + " contained invalid base64 data");
  }

  const estimatedBytes = Math.floor(clean.length * 3 / 4);
  if (estimatedBytes > maxBytes) throw new Error(name + " exceeds binary safety limit");

  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const bytes = Buffer.from(padded, "base64");
  const canonical = bytes.toString("base64").replace(/=+$/, "");

  if (canonical !== clean.replace(/=+$/, "")) throw new Error(name + " contained invalid base64 data");
  if (bytes.length > maxBytes) throw new Error(name + " exceeds binary safety limit");
  return bytes;
}

function decodeFloatSeries(base64) {
  const bytes = decodeBase64(base64, "FFT/TWF payload");
  if (bytes.length % 4 !== 0) throw new Error("FFT/TWF payload length is not aligned to float32 values");

  const values = [];
  for (let i = 0; i < bytes.length; i += 4) values.push(bytes.readFloatLE(i));
  return values;
}

function envEnabled(value) {
  return value === "1" || value === "true";
}

function validateRawEndpoint(endpoint, env = process.env) {
  if (!envEnabled(env.EIA_ALLOW_RAW)) {
    throw new Error("raw endpoint access is disabled; set EIA_ALLOW_RAW=1 only when explicitly needed");
  }

  if (!endpoint || !/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(endpoint)) {
    throw new Error("raw requires a safe endpoint name");
  }

  if (!RAW_READ_PREFIX.test(endpoint) && !envEnabled(env.EIA_ALLOW_UNSAFE_RAW)) {
    throw new Error("Raw endpoints not clearly read-only require EIA_ALLOW_UNSAFE_RAW=1");
  }

  return endpoint;
}

function assertSafeObject(value, path = "data") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) throw new Error(path + " must not provide credential fields");
    if (["__proto__", "prototype", "constructor"].includes(key)) {
      throw new Error(path + " contains an unsafe object key");
    }
    if (item && typeof item === "object") assertSafeObject(item, path + "." + key);
  }
}

function parseRawData(raw) {
  if (raw === undefined) return {};

  if (Buffer.byteLength(String(raw), "utf8") > MAX_RAW_JSON_BYTES) {
    throw new Error("--data exceeds the raw JSON safety limit");
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("--data must be valid JSON");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("--data must be a JSON object");
  }

  assertSafeObject(data);
  return data;
}


function assertKnownOptions(command, options) {
  const common = new Set(["pretty", "help"]);
  const allowed = {
    login: [],
    companies: [],
    areas: ["company"],
    machines: ["area"],
    points: ["machine"],
    axes: ["machine", "point"],
    history: ["machine", "point", "axis", "start", "end", "rms"],
    "sensor-data": ["phantom", "start", "end"],
    units: [],
    "extra-values": ["machine", "point", "unit", "start", "end"],
    thermo: ["machine", "point", "file", "outputFile", "overwrite"],
    devices: ["company", "area", "machine", "point"],
    "devices-by-code": ["codes"],
    current: ["company", "area", "machine", "point", "axis"],
    "all-current": ["since"],
    "all-devices": [],
    assignments: ["code"],
    fft: ["machine", "point", "file", "axis", "output", "signal", "frequency"],
    raw: ["data"],
  };

  if (!Object.prototype.hasOwnProperty.call(allowed, command)) return;
  const accepted = new Set([...common, ...allowed[command]]);
  const unknown = Object.keys(options).filter(key => !accepted.has(key));
  if (unknown.length) throw new Error("Unknown option(s) for " + command + ": " + unknown.map(key => "--" + key.replace(/[A-Z]/g, m => "-" + m.toLowerCase())).join(", "));
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const { positional, options } = parseArgs(argv);
  const command = positional[0];

  if (!command || command === "help" || options.help !== undefined) {
    console.log(HELP);
    return;
  }

  assertKnownOptions(command, options);
  const pretty = bool(options.pretty, false);

  if (command === "login") {
    const result = sanitizeOutput(await login(env));
    console.log(JSON.stringify(result, null, pretty ? 2 : 0));
    return;
  }

  let result;
  const authToken = await token(env);

  if (commandMap[command]) {
    const [endpoint, payload] = commandMap[command];
    result = normalize(await post(endpoint, { ...payload(options), Token: authToken }, { env }));
  } else if (command === "fft") {
    required(options, "machine", "point", "file");

    const outputTypes = { fft: 1, twf: 2 };
    const signalTypes = { g: 0, "mm-s2": 1, "mm-s": 2, "in-s": 3, um: 4, mils: 5, ge: 6 };
    const output = options.output ?? "fft";
    const signal = options.signal ?? "g";
    const frequency = options.frequency ?? "hz";

    if (!(output in outputTypes) || !(signal in signalTypes) || !["hz", "cpm"].includes(frequency)) {
      throw new Error("Invalid FFT output, signal, or frequency option");
    }

    result = normalize(await post("GetFFT_Base64", {
      OutputType: outputTypes[output],
      SignalTypeOut: signalTypes[signal],
      axis: bool(options.axis, true),
      fileid: int(options.file, "file"),
      hz: frequency === "cpm",
      machinecode: int(options.machine, "machine"),
      pointindex: int(options.point, "point"),
      Token: authToken,
    }, { env }));

    const item = result.data;
    if (item?.base64) {
      result.data = { ...item, values: decodeFloatSeries(item.base64), base64: undefined };
    }
  } else if (command === "thermo") {
    required(options, "machine", "point", "file", "outputFile");

    const response = normalize(await post("GetThermoData", {
      fileID: int(options.file, "file"),
      machineCode: int(options.machine, "machine"),
      pointIndex: int(options.point, "point"),
      Token: authToken,
    }, { env }));

    const encoded = Array.isArray(response.data) ? response.data[0] : response.data;
    const image = decodeBase64(encoded, "Thermal response");
    const outputFile = safeText(options.outputFile, "output-file", 4096);
    if (!outputFile) throw new Error("output-file cannot be empty");

    const overwrite = bool(options.overwrite, false);
    await writeFile(outputFile, image, { flag: overwrite ? "w" : "wx", mode: 0o600 });

    result = {
      status: response.status,
      data: { outputFile, bytes: image.length, overwritten: overwrite },
    };
  } else if (command === "raw") {
    const endpoint = validateRawEndpoint(positional[1], env);
    const data = parseRawData(options.data);

    result = normalize(await post(endpoint, { ...data, Token: authToken }, {
      env,
      retryable: false,
      retries: 0,
    }));
  } else {
    throw new Error("Unknown command: " + command + ". Run help for usage.");
  }

  console.log(JSON.stringify(sanitizeOutput(result), null, pretty ? 2 : 0));
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

if (isDirectExecution()) {
  main().catch(error => {
    console.error("[eia] " + redactText(error?.message || String(error)));
    process.exitCode = 1;
  });
}

export {
  HELP,
  commandMap,
  dateRange,
  decodeBase64,
  decodeFloatSeries,
  endpointUrl,
  expandTables,
  getBaseUrl,
  int,
  main,
  normalize,
  parseArgs,
  parseDateValue,
  parseRawData,
  post,
  redactText,
  safeText,
  sanitizeOutput,
  validateRawEndpoint,
  assertKnownOptions,
};
