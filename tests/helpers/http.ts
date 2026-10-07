/**
 * Preview HTTP helpers for Vitest integration tests.
 * Mirrors the cookie-jar + Origin pattern from scripts/smoke.mjs without expanding smoke itself.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type CookieJar = Map<string, string>;

/** Same lookup as scripts/smoke.mjs: process.env, then repo-root `.env`. */
function envValue(name: string): string {
  if (process.env[name]) return process.env[name];
  try {
    const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
    const text = readFileSync(envPath, "utf8");
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

export interface RequestOptions {
  method?: string;
  form?: Record<string, string>;
  json?: unknown;
  headers?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  location: string;
  body: unknown;
}

export interface HttpClient {
  baseUrl: string;
  origin: string;
  jar: CookieJar;
  request: (path: string, options?: RequestOptions) => Promise<HttpResponse>;
  signIn: (email: string, password: string) => Promise<HttpResponse>;
  clearCookies: () => void;
  deleteCookie: (name: string) => void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * True when a preview absolute http(s) URL is available.
 * Prefers PREVIEW_BASE_URL / TEST_BASE_URL (Vite/Vitest also set BASE_URL to the asset base "/").
 */
export function hasBaseUrl(): boolean {
  return Boolean(resolvePreviewBaseUrl());
}

function resolvePreviewBaseUrl(): string | undefined {
  for (const key of ["PREVIEW_BASE_URL", "TEST_BASE_URL", "BASE_URL"] as const) {
    const value = process.env[key]?.trim();
    if (value && isPreviewBaseUrl(value)) return normalizeBaseUrl(value);
  }
  return undefined;
}

function isPreviewBaseUrl(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns trimmed preview base URL or throws (integration tests should skip when unset). */
export function requireBaseUrl(): string {
  const value = resolvePreviewBaseUrl();
  if (!value) {
    throw new Error("PREVIEW_BASE_URL or BASE_URL is required for integration tests (e.g. http://localhost:4321)");
  }
  return value;
}

/**
 * Credentials for signed-in preview calls.
 * Prefers TEST_EMAIL/TEST_PASSWORD, then SMOKE_EMAIL/SMOKE_PASSWORD (CI smoke user).
 */
export function resolveTestCredentials(): { email: string; password: string } | null {
  const email = (envValue("TEST_EMAIL") || envValue("SMOKE_EMAIL")).trim();
  const password = (envValue("TEST_PASSWORD") || envValue("SMOKE_PASSWORD")).trim();
  if (!email || !password) return null;
  return { email, password };
}

/** Second GM for cross-owner integration cases; reads TEST_EMAIL_B / TEST_PASSWORD_B only. */
export function resolveSecondTestCredentials(): { email: string; password: string } | null {
  const email = envValue("TEST_EMAIL_B").trim();
  const password = envValue("TEST_PASSWORD_B").trim();
  if (!email || !password) return null;
  return { email, password };
}

export interface ForgePlayerCookieOverrides {
  lastNick?: string;
  playerId?: string;
  claimToken?: string;
  nick?: string;
  color?: number;
  seen?: number;
}

/** JSON cookie value for `rpg_player` with well-formed UUID playerId / claimToken (abuse/matrix tests). */
export function forgePlayerCookie(code: string, overrides?: ForgePlayerCookieOverrides): string {
  const nick = overrides?.nick ?? "Contract";
  return JSON.stringify({
    lastNick: overrides?.lastNick ?? nick,
    byCode: {
      [code]: {
        playerId: overrides?.playerId ?? "11111111-1111-4111-8111-111111111111",
        claimToken: overrides?.claimToken ?? "22222222-2222-4222-8222-222222222222",
        nick,
        color: overrides?.color ?? 1,
        seen: overrides?.seen ?? Date.now(),
      },
    },
  });
}

export function createHttpClient(baseUrl: string): HttpClient {
  const normalized = normalizeBaseUrl(baseUrl);
  const origin = new URL(normalized).origin;
  const jar: CookieJar = new Map();

  function cookieHeader(): string {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function storeCookies(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const [name, ...rest] = pair.split("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
      if (expired) jar.delete(name.trim());
      else jar.set(name.trim(), rest.join("="));
    }
  }

  async function request(path: string, options: RequestOptions = {}): Promise<HttpResponse> {
    const { method = "GET", form, json, headers: requestHeaders } = options;
    const headers: Record<string, string> = {
      Origin: origin,
      ...requestHeaders,
      Cookie: cookieHeader(),
    };
    let body: string | undefined;
    if (form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(form).toString();
    } else if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    }

    const response = await fetch(normalized + path, {
      method,
      redirect: "manual",
      headers,
      body,
    });
    storeCookies(response);

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    let parsedBody: unknown = text;
    if (contentType.includes("application/json") && text) {
      try {
        parsedBody = JSON.parse(text) as unknown;
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

  async function signIn(email: string, password: string): Promise<HttpResponse> {
    return request("/api/auth/signin", {
      method: "POST",
      form: { email, password },
      headers: { Accept: "application/json" },
    });
  }

  return {
    baseUrl: normalized,
    origin,
    jar,
    request,
    signIn,
    clearCookies: () => {
      jar.clear();
    },
    deleteCookie: (name: string) => {
      jar.delete(name);
    },
  };
}

export interface JoinPlayerInput {
  code: string;
  nick: string;
}

/**
 * Form-join a player into a session (`POST /api/play/join`).
 * Asserts 302 (smoke contract); the client's jar/`Origin` store `rpg_player` from Set-Cookie.
 * For dual-player / race cases, prefer two `createHttpClient()` instances over
 * `deleteCookie("rpg_player")` on a single client.
 */
export async function joinPlayer(client: HttpClient, { code, nick }: JoinPlayerInput): Promise<HttpResponse> {
  const response = await client.request("/api/play/join", {
    method: "POST",
    form: { code, nick },
  });
  if (response.status !== 302) {
    throw new Error(`joinPlayer expected 302, got ${response.status}`);
  }
  return response;
}

/** Create-session JSON body (authenticated GM). */
export interface CreateActiveSessionBody {
  size: 3 | 4 | 5;
  customPhrases: { text: string; guaranteed: boolean }[];
  rewards: { rewardId: string; count: number }[];
}

export interface CreatedSession {
  id: string;
  code: string;
}

/**
 * Authenticated GM session create (`POST /api/sessions`).
 * Asserts 201 and returns `{ id, code }` strings. Caller must have `signIn` on `gmClient` first.
 */
export async function createActiveSession(
  gmClient: HttpClient,
  body: CreateActiveSessionBody,
): Promise<CreatedSession> {
  const response = await gmClient.request("/api/sessions", {
    method: "POST",
    json: body,
  });
  if (response.status !== 201) {
    throw new Error(`createActiveSession expected 201, got ${response.status}`);
  }
  const payload = response.body as { id?: unknown; code?: unknown };
  if (typeof payload.id !== "string" || typeof payload.code !== "string") {
    throw new Error("createActiveSession response missing id/code strings");
  }
  return { id: payload.id, code: payload.code };
}
