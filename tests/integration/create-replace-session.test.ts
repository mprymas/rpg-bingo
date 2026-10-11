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

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())(
  "POST /api/sessions — replaceSessionId create-then-close",
  () => {
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

    it("create with replaceSessionId closes the source and links successor", async () => {
      const source = await createActiveSession(gm, emptySessionBody);

      const created = await gm.request("/api/sessions", {
        method: "POST",
        json: { ...emptySessionBody, replaceSessionId: source.id },
      });
      expect(created.status).toBe(201);
      const body = created.body as { id?: string; code?: string; closeError?: string };
      expect(typeof body.id).toBe("string");
      expect(typeof body.code).toBe("string");
      expect(body.closeError).toBeUndefined();
      if (typeof body.id !== "string") {
        throw new Error("create response missing id");
      }

      const sourceBoard = await gm.request(`/api/sessions/${source.id}/board`);
      expect(sourceBoard.status).toBe(200);
      const sourceDto = sourceBoard.body as {
        status?: string;
        replaced_by_session_id?: string | null;
      };
      expect(sourceDto.status).toBe("closed");
      expect(sourceDto.replaced_by_session_id).toBe(body.id);

      const newBoard = await gm.request(`/api/sessions/${body.id}/board`);
      expect(newBoard.status).toBe(200);
      expect((newBoard.body as { status?: string }).status).toBe("active");
    });

    it("unknown replaceSessionId leaves create 201 with closeError; retry close works", async () => {
      const source = await createActiveSession(gm, emptySessionBody);

      const created = await gm.request("/api/sessions", {
        method: "POST",
        json: { ...emptySessionBody, replaceSessionId: UNKNOWN_SESSION_ID },
      });
      expect(created.status).toBe(201);
      const body = created.body as { id?: string; closeError?: string };
      expect(typeof body.id).toBe("string");
      expect(typeof body.closeError).toBe("string");
      if (typeof body.closeError !== "string") {
        throw new Error("create response missing closeError");
      }
      expect(body.closeError.trim().length).toBeGreaterThan(0);
      if (typeof body.id !== "string") {
        throw new Error("create response missing id");
      }

      const stillOpen = await gm.request(`/api/sessions/${source.id}/board`);
      expect(stillOpen.status).toBe(200);
      expect((stillOpen.body as { status?: string }).status).toBe("active");

      const retry = await gm.request(`/api/sessions/${source.id}/close`, {
        method: "POST",
        json: { replacedBySessionId: body.id },
      });
      expect(retry.status).toBe(200);
      expect((retry.body as { ok?: boolean }).ok).toBe(true);

      const closed = await gm.request(`/api/sessions/${source.id}/board`);
      expect(closed.status).toBe(200);
      const closedDto = closed.body as { status?: string; replaced_by_session_id?: string | null };
      expect(closedDto.status).toBe("closed");
      expect(closedDto.replaced_by_session_id).toBe(body.id);
    });

    describe.skipIf(!resolveSecondTestCredentials())("foreign replaceSessionId", () => {
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

      it("foreign replaceSessionId does not close owner session (closeError)", async () => {
        const ownerSession = await createActiveSession(gm, emptySessionBody);

        const created = await otherGm.request("/api/sessions", {
          method: "POST",
          json: { ...emptySessionBody, replaceSessionId: ownerSession.id },
        });
        expect(created.status).toBe(201);
        const body = created.body as { id?: string; closeError?: string };
        expect(typeof body.id).toBe("string");
        expect(typeof body.closeError).toBe("string");

        const ownerBoard = await gm.request(`/api/sessions/${ownerSession.id}/board`);
        expect(ownerBoard.status).toBe(200);
        expect((ownerBoard.body as { status?: string }).status).toBe("active");
        expect((ownerBoard.body as { replaced_by_session_id?: string | null }).replaced_by_session_id).toBeNull();
      });
    });
  },
);
