import test from "node:test";
import assert from "node:assert/strict";

import {
  commandMap,
  dateRange,
  decodeFloatSeries,
  getBaseUrl,
  int,
  normalize,
  parseArgs,
  parseDateValue,
  parseRawData,
  post,
  redactText,
  sanitizeOutput,
  validateRawEndpoint,
} from "./eia.mjs";

test("parseArgs parses flags and rejects duplicates", () => {
  assert.deepEqual(
    parseArgs(["history", "--machine", "42", "--pretty", "--rms=false"]),
    {
      positional: ["history"],
      options: { machine: "42", pretty: true, rms: "false" },
    },
  );

  assert.throws(
    () => parseArgs(["current", "--machine", "1", "--machine", "2"]),
    /Duplicate option/,
  );
});

test("integer parsing is strict and safe", () => {
  assert.equal(int("42", "machine"), 42);
  assert.equal(int("-1", "machine"), -1);
  assert.throws(() => int("1e2", "machine"), /must be an integer/);
  assert.throws(() => int("1.5", "machine"), /must be an integer/);
  assert.throws(() => int("9007199254740992", "machine"), /safe integer/);
});

test("date parsing validates calendar values and ordering", () => {
  assert.equal(parseDateValue("2026-02-28", "date").text, "2026-02-28");
  assert.equal(parseDateValue("2026-02-28T12:30:45", "date").text, "2026-02-28 12:30:45");
  assert.throws(() => parseDateValue("2026-02-30", "date"), /valid calendar date/);
  assert.throws(() => parseDateValue("02-28-2026", "date"), /YYYY-MM-DD/);

  assert.deepEqual(
    dateRange("2026-01-01", "2026-01-02"),
    { start: "2026-01-01", end: "2026-01-02" },
  );
  assert.throws(
    () => dateRange("2026-01-03", "2026-01-02"),
    /start must be before or equal to end/,
  );
});

test("history command validates and normalizes dates", () => {
  const [, build] = commandMap.history;
  assert.deepEqual(
    build({
      machine: "10",
      point: "1",
      axis: "2",
      start: "2026-01-01T00:00:00",
      end: "2026-01-02 00:00:00",
      rms: "false",
    }),
    {
      machinecode: 10,
      pointindex: 1,
      axis: 2,
      StartDate: "2026-01-01 00:00:00",
      EndDate: "2026-01-02 00:00:00",
      getRMS: false,
    },
  );
});

test("base URL requires HTTPS except localhost and strips query/fragment", () => {
  assert.equal(
    getBaseUrl({}),
    "https://api.eianalytic.com/ApiWeb.svc",
  );
  assert.equal(
    getBaseUrl({ EIA_BASE_URL: "https://example.com/api/?debug=1#x" }),
    "https://example.com/api",
  );
  assert.equal(
    getBaseUrl({ EIA_BASE_URL: "http://localhost:4000/ApiWeb.svc/" }),
    "http://localhost:4000/ApiWeb.svc",
  );

  assert.throws(
    () => getBaseUrl({ EIA_BASE_URL: "http://example.com/api" }),
    /must use HTTPS/,
  );
  assert.throws(
    () => getBaseUrl({ EIA_BASE_URL: "https://user:pass@example.com/api" }),
    /must not contain credentials/,
  );
});

test("normalize expands tabular API envelopes", () => {
  const result = normalize([{
    Key: { StatusNumber: 0, Description: "ok" },
    Value: {
      columns: ["id", "name"],
      data: [
        [1, "Pump A"],
        [2, "Pump B"],
      ],
    },
  }]);

  assert.deepEqual(result, {
    status: { number: 0, description: "ok" },
    data: [
      { id: 1, name: "Pump A" },
      { id: 2, name: "Pump B" },
    ],
  });
});

test("normalize treats nonzero API status as failure and strips control characters", () => {
  assert.throws(
    () => normalize([{
      Key: { StatusNumber: 7, Description: "bad\nrequest\u0000" },
      Value: null,
    }]),
    /EI Analytic 7: bad request/,
  );
});

test("sanitizeOutput recursively redacts sensitive keys", () => {
  assert.deepEqual(
    sanitizeOutput({
      Token: "abc",
      nested: {
        password: "secret",
        value: 12,
        api_key: "xyz",
      },
    }),
    {
      Token: "[REDACTED]",
      nested: {
        password: "[REDACTED]",
        value: 12,
        api_key: "[REDACTED]",
      },
    },
  );
});

test("redactText removes configured secrets and bearer tokens", () => {
  const env = {
    EIA_EMAIL: "user@example.com",
    EIA_PASSWORD: "p@ss",
    EIA_DATABASE: "plant-a",
    EIA_TOKEN: "tok-123",
  };

  const result = redactText(
    "user@example.com p@ss plant-a tok-123 Bearer abc.def?x=1 token=raw-secret",
    env,
  );

  assert.equal(result.includes("user@example.com"), false);
  assert.equal(result.includes("p@ss"), false);
  assert.equal(result.includes("plant-a"), false);
  assert.equal(result.includes("tok-123"), false);
  assert.equal(result.includes("abc.def"), false);
  assert.equal(result.includes("raw-secret"), false);
});

test("raw access requires explicit opt-in and extra opt-in for mutation-like endpoints", () => {
  assert.throws(
    () => validateRawEndpoint("GetExperimental", {}),
    /raw endpoint access is disabled/,
  );

  assert.equal(
    validateRawEndpoint("GetExperimental", { EIA_ALLOW_RAW: "1" }),
    "GetExperimental",
  );

  assert.throws(
    () => validateRawEndpoint("UpdateMachine", { EIA_ALLOW_RAW: "1" }),
    /state-changing raw endpoints/,
  );

  assert.equal(
    validateRawEndpoint("UpdateMachine", {
      EIA_ALLOW_RAW: "1",
      EIA_ALLOW_UNSAFE_RAW: "1",
    }),
    "UpdateMachine",
  );

  assert.throws(
    () => validateRawEndpoint("../GetCompanies", { EIA_ALLOW_RAW: "1" }),
    /safe endpoint name/,
  );
});

test("raw JSON must be a safe object without credential fields", () => {
  assert.deepEqual(parseRawData('{"machineCode":42}'), { machineCode: 42 });
  assert.throws(() => parseRawData("[]"), /JSON object/);
  assert.throws(() => parseRawData('{"Token":"secret"}'), /credential fields/);
  assert.throws(() => parseRawData('{"nested":{"password":"secret"}}'), /credential fields/);
});

test("FFT/TWF float decoder rejects malformed data", () => {
  const bytes = Buffer.alloc(8);
  bytes.writeFloatLE(1.25, 0);
  bytes.writeFloatLE(-2.5, 4);

  assert.deepEqual(decodeFloatSeries(bytes.toString("base64")), [1.25, -2.5]);
  assert.throws(() => decodeFloatSeries(Buffer.from([1, 2, 3]).toString("base64")), /float32/);
  assert.throws(() => decodeFloatSeries("%%%"), /invalid base64/);
});

test("post retries transient HTTP errors but never follows redirects", async () => {
  let calls = 0;
  const seen = [];

  const fetchImpl = async (url, init) => {
    calls += 1;
    seen.push({ url, redirect: init.redirect, body: JSON.parse(init.body) });

    if (calls === 1) {
      return new Response("temporary", {
        status: 503,
        headers: { "retry-after": "0" },
      });
    }

    return new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await post(
    "GetCompanies",
    { Token: "secret" },
    {
      env: { EIA_BASE_URL: "https://example.com/ApiWeb.svc" },
      fetchImpl,
      retries: 1,
      timeoutMs: 1000,
    },
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
  assert.equal(seen[0].redirect, "error");
  assert.equal(seen[0].url, "https://example.com/ApiWeb.svc/GetCompanies");
});

test("post rejects oversized responses before reading the body", async () => {
  const fetchImpl = async () => new Response("{}", {
    status: 200,
    headers: { "content-length": String(65 * 1024 * 1024) },
  });

  await assert.rejects(
    () => post(
      "GetCompanies",
      {},
      {
        env: { EIA_BASE_URL: "https://example.com/ApiWeb.svc" },
        fetchImpl,
        retries: 0,
      },
    ),
    /response exceeds safety limit/,
  );
});

test("post non-JSON errors do not echo remote response bodies", async () => {
  const fetchImpl = async () => new Response("server-secret-value", { status: 200 });

  await assert.rejects(
    () => post(
      "GetCompanies",
      {},
      {
        env: { EIA_BASE_URL: "https://example.com/ApiWeb.svc" },
        fetchImpl,
        retries: 0,
      },
    ),
    error => {
      assert.match(error.message, /returned non-JSON/);
      assert.equal(error.message.includes("server-secret-value"), false);
      return true;
    },
  );
});
