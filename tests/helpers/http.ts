/**
 * Preview HTTP helpers for Vitest integration tests.
 * Mirrors the cookie-jar + Origin pattern from scripts/smoke.mjs without expanding smoke itself.
 */

export type CookieJar = Map<string, string>;

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

export function hasBaseUrl(): boolean {
  return Boolean(process.env.BASE_URL?.trim());
}

/** Returns trimmed BASE_URL or throws (integration tests should skip when unset). */
export function requireBaseUrl(): string {
  const value = process.env.BASE_URL?.trim();
  if (!value) {
    throw new Error("BASE_URL is required for integration tests (e.g. http://localhost:4321)");
  }
  return normalizeBaseUrl(value);
}

/**
 * Credentials for signed-in preview calls.
 * Prefers TEST_EMAIL/TEST_PASSWORD, then SMOKE_EMAIL/SMOKE_PASSWORD (CI smoke user).
 */
export function resolveTestCredentials(): { email: string; password: string } | null {
  const email = (process.env.TEST_EMAIL ?? process.env.SMOKE_EMAIL ?? "").trim();
  const password = (process.env.TEST_PASSWORD ?? process.env.SMOKE_PASSWORD ?? "").trim();
  if (!email || !password) return null;
  return { email, password };
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
