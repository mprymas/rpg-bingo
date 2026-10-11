import { beforeAll, describe, expect, it } from "vitest";
import {
  createActiveSession,
  createHttpClient,
  hasBaseUrl,
  resolveSecondTestCredentials,
  resolveTestCredentials,
  requireBaseUrl,
  type HttpClient,
} from "../helpers/http";

const UNKNOWN_SESSION_ID = "00000000-0000-4000-8000-000000000001";
const REPLACEMENT_ID = "00000000-0000-4000-8000-000000000002";

const emptySessionBody = {
  size: 3 as const,
  customPhrases: [] as { text: string; guaranteed: boolean }[],
  rewards: [] as { rewardId: string; count: number }[],
};

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

describe.skipIf(!hasBaseUrl())("POST /api/sessions/[id]/close — unauthenticated", () => {
  let http: HttpClient;

  beforeAll(() => {
    http = createHttpClient(requireBaseUrl());
  });

  it("returns 401 without auth", async () => {
    const actual = await http.request(`/api/sessions/${UNKNOWN_SESSION_ID}/close`, {
      method: "POST",
      json: { replacedBySessionId: REPLACEMENT_ID },
    });
    expect(actual.status).toBe(401);
    assertErrorBody(actual.body);
  });
});

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())("POST /api/sessions/[id]/close — auth matrix", () => {
  let gm: HttpClient;

  beforeAll(async () => {
    const credentials = resolveTestCredentials();
    expect(credentials).not.toBeNull();
    if (!credentials) {
      throw new Error("TEST_/SMOKE_ credentials required for authenticated integration tests");
    }
    gm = createHttpClient(requireBaseUrl());
    const signIn = await gm.signIn(credentials.email, credentials.password);
    expect(signIn.status).toBe(200);
  });

  it("returns 400 for bad body", async () => {
    const actual = await gm.request(`/api/sessions/${UNKNOWN_SESSION_ID}/close`, {
      method: "POST",
      json: { replacedBySessionId: "not-a-uuid" },
    });
    expect(actual.status).toBe(400);
    assertErrorBody(actual.body);
  });

  it("returns 404 for unknown session id", async () => {
    const actual = await gm.request(`/api/sessions/${UNKNOWN_SESSION_ID}/close`, {
      method: "POST",
      json: { replacedBySessionId: REPLACEMENT_ID },
    });
    expect(actual.status).toBe(404);
    assertErrorBody(actual.body);
  });

  it("returns 409 when source is already closed", async () => {
    const source = await createActiveSession(gm, emptySessionBody);
    const created = await gm.request("/api/sessions", {
      method: "POST",
      json: { ...emptySessionBody, replaceSessionId: source.id },
    });
    expect(created.status).toBe(201);
    const body = created.body as { id?: string; closeError?: string };
    expect(typeof body.id).toBe("string");
    expect(body.closeError).toBeUndefined();
    if (typeof body.id !== "string") {
      throw new Error("create response missing id");
    }

    const again = await gm.request(`/api/sessions/${source.id}/close`, {
      method: "POST",
      json: { replacedBySessionId: body.id },
    });
    expect(again.status).toBe(409);
    assertErrorBody(again.body);
  });

  describe.skipIf(!resolveSecondTestCredentials())("foreign owner", () => {
    let otherGm: HttpClient;

    beforeAll(async () => {
      const second = resolveSecondTestCredentials();
      expect(second).not.toBeNull();
      if (!second) {
        throw new Error("TEST_EMAIL_B / TEST_PASSWORD_B required for cross-owner tests");
      }
      otherGm = createHttpClient(requireBaseUrl());
      const signIn = await otherGm.signIn(second.email, second.password);
      expect(signIn.status).toBe(200);
    });

    it("returns 404 when a foreign GM tries to close", async () => {
      const ownerSession = await createActiveSession(gm, emptySessionBody);
      const otherSession = await createActiveSession(otherGm, emptySessionBody);

      const actual = await otherGm.request(`/api/sessions/${ownerSession.id}/close`, {
        method: "POST",
        json: { replacedBySessionId: otherSession.id },
      });
      expect(actual.status).toBe(404);
      assertErrorBody(actual.body);

      const ownerBoard = await gm.request(`/api/sessions/${ownerSession.id}/board`);
      expect(ownerBoard.status).toBe(200);
      expect((ownerBoard.body as { status?: string }).status).toBe("active");
    });
  });
});
