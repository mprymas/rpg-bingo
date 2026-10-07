import { beforeAll, describe, expect, it } from "vitest";
import { PLAYER_COOKIE_NAME } from "@/lib/player-cookie";
import {
  createHttpClient,
  forgePlayerCookie,
  hasBaseUrl,
  resolveTestCredentials,
  requireBaseUrl,
  type HttpClient,
} from "../helpers/http";

/** Valid UUID that is not expected to exist as a session. */
const UNKNOWN_SESSION_ID = "00000000-0000-4000-8000-000000000001";
/** Valid session-code alphabet shape; not expected to map to an active session. */
const UNKNOWN_SESSION_CODE = "ZZZZZ2";

function assertErrorBody(body: unknown) {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  if (typeof body !== "object" || body === null || !("error" in body)) {
    throw new Error("expected JSON body with error field");
  }
  const error = body.error;
  expect(typeof error).toBe("string");
  expect((error as string).trim().length).toBeGreaterThan(0);
}

describe.skipIf(!hasBaseUrl())("HTTP contract matrix — unauthenticated / public failures", () => {
  let http: HttpClient;

  beforeAll(() => {
    http = createHttpClient(requireBaseUrl());
  });

  it("GET /api/sessions/[id]/board → 401 without auth", async () => {
    const actual = await http.request(`/api/sessions/${UNKNOWN_SESSION_ID}/board`);
    expect(actual.status).toBe(401);
    assertErrorBody(actual.body);
  });

  it("GET /api/play/board → 400 for bad code", async () => {
    const actual = await http.request("/api/play/board?code=!!bad");
    expect(actual.status).toBe(400);
    assertErrorBody(actual.body);
  });

  it("GET /api/play/board → 404 for unknown/inactive code", async () => {
    const actual = await http.request(`/api/play/board?code=${UNKNOWN_SESSION_CODE}`);
    expect(actual.status).toBe(404);
    assertErrorBody(actual.body);
  });

  it("POST /api/play/claim → 400 for bad body/position", async () => {
    const actual = await http.request("/api/play/claim", {
      method: "POST",
      json: { code: UNKNOWN_SESSION_CODE, position: -1 },
    });
    expect(actual.status).toBe(400);
    assertErrorBody(actual.body);
  });

  it("POST /api/play/claim → 401 when player cookie missing", async () => {
    http.deleteCookie(PLAYER_COOKIE_NAME);
    const actual = await http.request("/api/play/claim", {
      method: "POST",
      json: { code: UNKNOWN_SESSION_CODE, position: 0 },
    });
    expect(actual.status).toBe(401);
    assertErrorBody(actual.body);
  });

  it("POST /api/play/claim → 401 for invalid player cookie", async () => {
    http.jar.set(PLAYER_COOKIE_NAME, "not-a-player-cookie");
    const actual = await http.request("/api/play/claim", {
      method: "POST",
      json: { code: UNKNOWN_SESSION_CODE, position: 0 },
    });
    expect(actual.status).toBe(401);
    assertErrorBody(actual.body);
  });

  it("POST /api/play/claim → 404 for unknown session code with forged identity", async () => {
    http.jar.set(PLAYER_COOKIE_NAME, forgePlayerCookie(UNKNOWN_SESSION_CODE));
    const actual = await http.request("/api/play/claim", {
      method: "POST",
      json: { code: UNKNOWN_SESSION_CODE, position: 0 },
    });
    expect(actual.status).toBe(404);
    assertErrorBody(actual.body);
  });

  it("POST /api/sessions/[id]/undo-claim → 401 without auth", async () => {
    http.clearCookies();
    const actual = await http.request(`/api/sessions/${UNKNOWN_SESSION_ID}/undo-claim`, {
      method: "POST",
      json: { position: 0 },
    });
    expect(actual.status).toBe(401);
    assertErrorBody(actual.body);
  });
});

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())(
  "HTTP contract matrix — authenticated failure paths",
  () => {
    let http: HttpClient;

    beforeAll(async () => {
      const credentials = resolveTestCredentials();
      expect(credentials).not.toBeNull();
      if (!credentials) {
        throw new Error("TEST_/SMOKE_ credentials required for authenticated contract tests");
      }
      http = createHttpClient(requireBaseUrl());
      const signIn = await http.signIn(credentials.email, credentials.password);
      expect(signIn.status).toBe(200);
    });

    it("GET /api/sessions/[id]/board → 404 for unknown session id", async () => {
      const actual = await http.request(`/api/sessions/${UNKNOWN_SESSION_ID}/board`);
      expect(actual.status).toBe(404);
      assertErrorBody(actual.body);
    });

    it("POST /api/sessions/[id]/undo-claim → 400 for bad body", async () => {
      const actual = await http.request(`/api/sessions/${UNKNOWN_SESSION_ID}/undo-claim`, {
        method: "POST",
        json: { position: -1 },
      });
      expect(actual.status).toBe(400);
      assertErrorBody(actual.body);
    });

    it("POST /api/sessions/[id]/undo-claim → 404 for unknown session", async () => {
      const actual = await http.request(`/api/sessions/${UNKNOWN_SESSION_ID}/undo-claim`, {
        method: "POST",
        json: { position: 0 },
      });
      expect(actual.status).toBe(404);
      assertErrorBody(actual.body);
    });
  },
);
