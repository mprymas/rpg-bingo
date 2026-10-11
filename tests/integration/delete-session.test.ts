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

async function closeAsReplaced(gm: HttpClient, sourceId: string): Promise<string> {
  const created = await gm.request("/api/sessions", {
    method: "POST",
    json: { ...emptySessionBody, replaceSessionId: sourceId },
  });
  expect(created.status).toBe(201);
  const body = created.body as { id?: string; closeError?: string };
  expect(typeof body.id).toBe("string");
  expect(body.closeError).toBeUndefined();
  if (typeof body.id !== "string") {
    throw new Error("create response missing id");
  }

  const sourceBoard = await gm.request(`/api/sessions/${sourceId}/board`);
  expect(sourceBoard.status).toBe(200);
  expect((sourceBoard.body as { status?: string }).status).toBe("closed");

  return body.id;
}

describe.skipIf(!hasBaseUrl())("DELETE /api/sessions/[id] — unauthenticated", () => {
  let http: HttpClient;

  beforeAll(() => {
    http = createHttpClient(requireBaseUrl());
  });

  it("returns 401 without auth", async () => {
    const actual = await http.request(`/api/sessions/${UNKNOWN_SESSION_ID}`, {
      method: "DELETE",
    });
    expect(actual.status).toBe(401);
    assertErrorBody(actual.body);
  });
});

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())("DELETE /api/sessions/[id] — auth matrix", () => {
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

  it("returns 404 for unknown session id", async () => {
    const actual = await gm.request(`/api/sessions/${UNKNOWN_SESSION_ID}`, {
      method: "DELETE",
    });
    expect(actual.status).toBe(404);
    assertErrorBody(actual.body);
  });

  it("owner deletes active → 200; subsequent DELETE and play board → 404", async () => {
    const session = await createActiveSession(gm, emptySessionBody);

    const deleted = await gm.request(`/api/sessions/${session.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect((deleted.body as { ok?: boolean }).ok).toBe(true);

    const again = await gm.request(`/api/sessions/${session.id}`, {
      method: "DELETE",
    });
    expect(again.status).toBe(404);
    assertErrorBody(again.body);

    const playBoard = await gm.request(`/api/play/board?code=${encodeURIComponent(session.code)}`);
    expect(playBoard.status).toBe(404);
    assertErrorBody(playBoard.body);
  });

  it("owner deletes closed → 200; gone", async () => {
    const source = await createActiveSession(gm, emptySessionBody);
    await closeAsReplaced(gm, source.id);

    const deleted = await gm.request(`/api/sessions/${source.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect((deleted.body as { ok?: boolean }).ok).toBe(true);

    const again = await gm.request(`/api/sessions/${source.id}`, {
      method: "DELETE",
    });
    expect(again.status).toBe(404);
    assertErrorBody(again.body);

    const ownerBoard = await gm.request(`/api/sessions/${source.id}/board`);
    expect(ownerBoard.status).toBe(404);
    assertErrorBody(ownerBoard.body);
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

    it("returns 404 when a foreign GM tries to delete; owner row unchanged", async () => {
      const ownerSession = await createActiveSession(gm, emptySessionBody);

      const actual = await otherGm.request(`/api/sessions/${ownerSession.id}`, {
        method: "DELETE",
      });
      expect(actual.status).toBe(404);
      assertErrorBody(actual.body);

      const ownerBoard = await gm.request(`/api/sessions/${ownerSession.id}/board`);
      expect(ownerBoard.status).toBe(200);
      expect((ownerBoard.body as { status?: string }).status).toBe("active");
    });
  });
});
