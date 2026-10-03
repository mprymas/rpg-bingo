// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// Does not create an account. Signed-in steps use SMOKE_EMAIL and SMOKE_PASSWORD
// from the environment, or from .env in the repo root when those are unset.

import { readFileSync } from "node:fs";

function envValue(name) {
  if (process.env[name]) return process.env[name];
  try {
    const text = readFileSync(new globalThis.URL("../.env", import.meta.url), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      if (trimmed.slice(0, eq).trim() !== name) continue;
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch {
    return "";
  }
  return "";
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const accountEmail = envValue("SMOKE_EMAIL");
const accountPassword = envValue("SMOKE_PASSWORD");
const hasAccount = accountEmail.length > 0 && accountPassword.length > 0;
const rejectEmail = "smoke-reject@example.com";
const jar = new Map();
const SESSION_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

let createdSessionId = "";
let createdSessionCode = "";

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form, json, headers: requestHeaders } = {}) {
  const headers = {
    Origin: BASE_URL,
    ...requestHeaders,
    Cookie: cookieHeader(),
  };
  let body;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(form).toString();
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers,
    body,
  });
  storeCookies(response);

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let parsedBody = text;
  if (contentType.includes("application/json") && text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  return {
    status: response.status,
    location: response.headers.get("location") ?? "",
    body: parsedBody,
  };
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "POST /api/sessions rejects anonymous",
    () =>
      request("/api/sessions", {
        method: "POST",
        json: { size: 5, customPhrases: [], rewards: [] },
      }),
    { status: 401 },
  ],
  ["GET /sessions/new redirects anonymous", () => request("/sessions/new"), { status: 302, location: "/auth/signin" }],
  [
    "GET /play/AAAAAA is not found",
    () => request("/play/AAAAAA"),
    {
      status: 404,
      check: (body) => typeof body === "string" && body.includes("Nie znaleziono sesji"),
    },
  ],
  [
    "GET /play/not-a-code is not found",
    () => request("/play/not-a-code"),
    {
      status: 404,
      check: (body) => typeof body === "string" && body.includes("Nie znaleziono sesji"),
    },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email: rejectEmail, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin JSON rejects wrong password",
    () =>
      request("/api/auth/signin", {
        method: "POST",
        form: { email: rejectEmail, password: "wrong" },
        headers: { Accept: "application/json" },
      }),
    {
      status: 401,
      check: (body) => typeof body?.error === "string" && body.error.length > 0,
    },
  ],
];

if (hasAccount) {
  steps.push(
    [
      "signin JSON accepts correct password",
      () =>
        request("/api/auth/signin", {
          method: "POST",
          form: { email: accountEmail, password: accountPassword },
          headers: { Accept: "application/json" },
        }),
      {
        status: 200,
        check: (body) => body?.redirect === "/dashboard",
      },
    ],
    [
      "signin accepts correct password",
      () => request("/api/auth/signin", { method: "POST", form: { email: accountEmail, password: accountPassword } }),
      { status: 302, location: "/dashboard" },
    ],
    ["home redirects signed-in user", () => request("/"), { status: 302, location: "/dashboard" }],
    [
      "dashboard renders for signed-in user",
      () => request("/dashboard"),
      {
        status: 200,
        check: (body) => typeof body === "string" && body.includes("Dołącz do sesji"),
      },
    ],
    ["GET /sessions/new for signed-in user", () => request("/sessions/new"), { status: 200 }],
    [
      "POST /api/sessions creates session",
      async () => {
        const actual = await request("/api/sessions", {
          method: "POST",
          json: {
            size: 5,
            customPhrases: [{ text: "Hasło ze smoke", guaranteed: true }],
            rewards: [],
          },
        });
        if (actual.status === 201 && actual.body?.id) {
          createdSessionId = actual.body.id;
        }
        if (actual.status === 201 && typeof actual.body?.code === "string") {
          createdSessionCode = actual.body.code;
        }
        return actual;
      },
      {
        status: 201,
        check: (body) => typeof body?.code === "string" && SESSION_CODE_RE.test(body.code),
      },
    ],
    ["GET /sessions/:id for owner", () => request(`/sessions/${createdSessionId}`), { status: 200 }],
    ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
    [
      "GET /sessions/:id redirects after signout",
      () => request(`/sessions/${createdSessionId}`),
      { status: 302, location: "/auth/signin" },
    ],
    ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
    [
      "GET /sessions/new redirects after signout",
      () => request("/sessions/new"),
      { status: 302, location: "/auth/signin" },
    ],
    [
      "GET /play/:code shows nick form before join",
      () => request(`/play/${createdSessionCode}`),
      {
        status: 200,
        check: (body) => typeof body === "string" && body.includes("Nick") && !body.includes("Hasło ze smoke"),
      },
    ],
    [
      "POST /api/play/join accepts nick",
      () =>
        request("/api/play/join", {
          method: "POST",
          form: { code: createdSessionCode, nick: "Anna" },
        }),
      { status: 302, location: `/play/${createdSessionCode}` },
    ],
    [
      "GET /play/:code shows board after join",
      () => request(`/play/${createdSessionCode}`),
      {
        status: 200,
        check: (body) => typeof body === "string" && body.includes("Hasło ze smoke") && body.includes("Anna"),
      },
    ],
    [
      "POST /api/play/claim claims free position",
      () =>
        request("/api/play/claim", {
          method: "POST",
          json: { code: createdSessionCode, position: 0 },
        }),
      {
        status: 200,
        check: (body) =>
          body?.cell?.position === 0 && typeof body?.cell?.claimedByColor === "number" && body.cell.claimedByColor >= 1,
      },
    ],
    [
      "POST /api/play/join as second player",
      async () => {
        jar.delete("rpg_player");
        return request("/api/play/join", {
          method: "POST",
          form: { code: createdSessionCode, nick: "Borin" },
        });
      },
      { status: 302, location: `/play/${createdSessionCode}` },
    ],
    [
      "POST /api/play/claim conflict for occupied position",
      () =>
        request("/api/play/claim", {
          method: "POST",
          json: { code: createdSessionCode, position: 0 },
        }),
      {
        status: 409,
        check: (body) =>
          body?.error === "conflict" &&
          body?.occupant?.nick === "Anna" &&
          typeof body?.occupant?.color === "number" &&
          body?.cell?.position === 0 &&
          typeof body?.cell?.claimedByColor === "number",
      },
    ],
    [
      "GET /api/play/board reflects claim occupant",
      () => request(`/api/play/board?code=${createdSessionCode}`),
      {
        status: 200,
        check: (body) => {
          const cell = Array.isArray(body?.cells) ? body.cells.find((c) => c.position === 0) : undefined;
          return (
            typeof body?.code === "string" &&
            cell != null &&
            typeof cell.claimedByColor === "number" &&
            cell.claimedByColor >= 1
          );
        },
      },
    ],
    [
      "POST /api/play/claim rejects cross-origin",
      () =>
        request("/api/play/claim", {
          method: "POST",
          json: { code: createdSessionCode, position: 1 },
          headers: { Origin: "https://evil.example" },
        }),
      {
        status: 403,
        check: (body) => body?.error === "Forbidden",
      },
    ],
    [
      "POST /api/play/join missing code redirects",
      () =>
        request("/api/play/join", {
          method: "POST",
          form: { code: "AAAAAA", nick: "Anna" },
        }),
      { status: 302, location: "/play/AAAAAA" },
    ],
    [
      "GET /play/AAAAAA stays not found after join attempt",
      () => request("/play/AAAAAA"),
      {
        status: 404,
        check: (body) => typeof body === "string" && body.includes("Nie znaleziono sesji"),
      },
    ],
  );
} else {
  console.log("SKIP  signed-in steps — set SMOKE_EMAIL and SMOKE_PASSWORD");
  steps.push(
    ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
    ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  );
}

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const statusOk = actual.status === expected.status;
  const locationOk = expected.location === undefined || actual.location.startsWith(expected.location);
  const checkOk = expected.check === undefined || expected.check(actual.body);
  const ok = statusOk && locationOk && checkOk;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
    if (expected.check && !checkOk) {
      console.log(`      check(body) failed: ${JSON.stringify(actual.body)}`);
    }
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
