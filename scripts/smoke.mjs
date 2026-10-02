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
    ...requestHeaders,
    Cookie: cookieHeader(),
    Origin: BASE_URL,
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
    ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
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
