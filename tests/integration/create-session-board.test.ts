import { beforeAll, describe, expect, it } from "vitest";
import { normalizePhrase } from "@/lib/services/board-generator";
import { createHttpClient, hasBaseUrl, resolveTestCredentials, requireBaseUrl, type HttpClient } from "../helpers/http";

const SESSION_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
/** Valid UUID shape that is not expected in the seeded rewards catalog. */
const UNKNOWN_REWARD_ID = "00000000-0000-4000-8000-000000000099";

interface CreateSessionBody {
  size: 3 | 4 | 5;
  customPhrases: { text: string; guaranteed: boolean }[];
  rewards: { rewardId: string; count: number }[];
}

interface BoardCellDto {
  position: number;
  phrase: string;
  reward_id: string | null;
}

interface GmBoardDto {
  id: string;
  size: number;
  cells: BoardCellDto[];
}

function assertPlayableBoard(board: GmBoardDto, size: number, allowedRewardIds: Set<string>) {
  expect(board.size).toBe(size);
  expect(Array.isArray(board.cells)).toBe(true);
  expect(board.cells).toHaveLength(size * size);

  const positions = board.cells.map((c) => c.position).sort((a, b) => a - b);
  expect(positions).toEqual(Array.from({ length: size * size }, (_, i) => i));

  const phrases = board.cells.map((c) => c.phrase);
  expect(phrases.every((p) => typeof p === "string" && p.trim().length >= 1)).toBe(true);
  expect(new Set(phrases).size).toBe(phrases.length);

  for (const cell of board.cells) {
    expect(cell.reward_id === null || allowedRewardIds.has(cell.reward_id)).toBe(true);
  }
}

/** Oracle = request guaranteed texts; compare with product normalize (trim / collapse / pl lower). */
function assertGuaranteedPhrasesOnBoard(board: GmBoardDto, guaranteedTexts: string[]) {
  const boardNorms = new Set(board.cells.map((c) => normalizePhrase(c.phrase)));
  for (const text of guaranteedTexts) {
    expect(boardNorms.has(normalizePhrase(text))).toBe(true);
  }
}

describe.skipIf(!hasBaseUrl())("POST /api/sessions — unauthenticated", () => {
  it("rejects create with 401", async () => {
    const http = createHttpClient(requireBaseUrl());
    const actual = await http.request("/api/sessions", {
      method: "POST",
      json: { size: 5, customPhrases: [], rewards: [] },
    });
    expect(actual.status).toBe(401);
  });
});

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())(
  "POST /api/sessions — authenticated create integrity",
  () => {
    let http: HttpClient;
    let credentials: { email: string; password: string };

    beforeAll(async () => {
      const resolved = resolveTestCredentials();
      expect(resolved).not.toBeNull();
      if (!resolved) {
        throw new Error("TEST_/SMOKE_ credentials required for authenticated integration tests");
      }
      credentials = resolved;
      http = createHttpClient(requireBaseUrl());
      const signIn = await http.signIn(credentials.email, credentials.password);
      expect(signIn.status).toBe(200);
    });

    it("returns 201 then GM board with playable size-5 invariants and guaranteed membership", async () => {
      const guaranteedTexts = [
        "Hasło gwarantowane integracja A",
        "Hasło gwarantowane integracja B",
        "Hasło gwarantowane integracja C",
      ];
      const createBody: CreateSessionBody = {
        size: 5,
        customPhrases: guaranteedTexts.map((text) => ({ text, guaranteed: true })),
        rewards: [],
      };
      const allowedRewardIds = new Set(createBody.rewards.filter((r) => r.count > 0).map((r) => r.rewardId));

      const created = await http.request("/api/sessions", {
        method: "POST",
        json: createBody,
      });
      expect(created.status).toBe(201);
      const body = created.body as { id?: string; code?: string };
      expect(typeof body.id).toBe("string");
      expect(typeof body.code).toBe("string");
      if (typeof body.id !== "string" || typeof body.code !== "string") {
        throw new Error("create response missing id/code");
      }
      expect(SESSION_CODE_RE.test(body.code)).toBe(true);

      const boardRes = await http.request(`/api/sessions/${body.id}/board`);
      expect(boardRes.status).toBe(200);
      const board = boardRes.body as GmBoardDto;
      assertPlayableBoard(board, 5, allowedRewardIds);
      assertGuaranteedPhrasesOnBoard(board, guaranteedTexts);
    });

    it("rejects empty custom phrase text with 400", async () => {
      const actual = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size: 5,
          customPhrases: [{ text: "   ", guaranteed: false }],
          rewards: [],
        },
      });
      expect(actual.status).toBe(400);
    });

    it("rejects bad size with 400", async () => {
      const actual = await http.request("/api/sessions", {
        method: "POST",
        json: { size: 2, customPhrases: [], rewards: [] },
      });
      expect(actual.status).toBe(400);
    });

    it("rejects unknown reward UUID with 400", async () => {
      const actual = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size: 5,
          customPhrases: [],
          rewards: [{ rewardId: UNKNOWN_REWARD_ID, count: 1 }],
        },
      });
      expect(actual.status).toBe(400);
    });
  },
);
