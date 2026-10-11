import { beforeAll, describe, expect, it } from "vitest";
import {
  createActiveSession,
  createHttpClient,
  hasBaseUrl,
  joinPlayer,
  resolveTestCredentials,
  requireBaseUrl,
  type HttpClient,
} from "../helpers/http";

const UNKNOWN_SESSION_CODE = "ZZZZZ2";

const emptySessionBody = {
  size: 3 as const,
  customPhrases: [] as { text: string; guaranteed: boolean }[],
  rewards: [] as { rewardId: string; count: number }[],
};

interface PlayerBoardDto {
  code?: string;
  size?: number;
  status?: string;
  successorCode?: string | null;
  cells?: unknown[];
  players?: unknown[];
}

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())(
  "Play closed board + successor rejoin (regenerate handoff)",
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

    it("after regenerate: old board closed + successorCode; claim fails; join successor works; unknown 404", async () => {
      const source = await createActiveSession(gm, emptySessionBody);

      const player = createHttpClient(requireBaseUrl());
      await joinPlayer(player, { code: source.code, nick: "Anna" });

      const created = await gm.request("/api/sessions", {
        method: "POST",
        json: { ...emptySessionBody, replaceSessionId: source.id },
      });
      expect(created.status).toBe(201);
      const newSession = created.body as { id?: string; code?: string; closeError?: string };
      expect(typeof newSession.id).toBe("string");
      expect(typeof newSession.code).toBe("string");
      expect(newSession.closeError).toBeUndefined();
      if (typeof newSession.code !== "string") {
        throw new Error("create response missing code");
      }

      const closedBoard = await player.request(`/api/play/board?code=${encodeURIComponent(source.code)}`);
      expect(closedBoard.status).toBe(200);
      const closedDto = closedBoard.body as PlayerBoardDto;
      expect(closedDto.status).toBe("closed");
      expect(closedDto.successorCode).toBe(newSession.code);
      expect(Array.isArray(closedDto.cells)).toBe(true);
      expect(Array.isArray(closedDto.players)).toBe(true);

      const claimOnClosed = await player.request("/api/play/claim", {
        method: "POST",
        json: { code: source.code, position: 0 },
      });
      expect(claimOnClosed.status).toBe(404);

      const joinSuccessor = await player.request("/api/play/join", {
        method: "POST",
        form: { code: newSession.code, nick: "Anna" },
        headers: { Accept: "application/json" },
      });
      expect(joinSuccessor.status).toBe(200);
      const joinBody = joinSuccessor.body as { redirect?: string };
      expect(joinBody.redirect).toBe(`/play/${newSession.code}`);

      const activeBoard = await player.request(`/api/play/board?code=${encodeURIComponent(newSession.code)}`);
      expect(activeBoard.status).toBe(200);
      const activeDto = activeBoard.body as PlayerBoardDto;
      expect(activeDto.status).toBe("active");
      expect(activeDto.successorCode).toBeNull();

      const unknown = await player.request(`/api/play/board?code=${UNKNOWN_SESSION_CODE}`);
      expect(unknown.status).toBe(404);
    });
  },
);
