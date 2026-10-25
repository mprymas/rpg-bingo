import { beforeAll, describe, expect, it } from "vitest";
import { normalizePhrase } from "@/lib/services/board-generator";
import {
  createActiveSession,
  createHttpClient,
  hasBaseUrl,
  joinPlayer,
  requireBaseUrl,
  resolveSecondTestCredentials,
  resolveTestCredentials,
  type HttpClient,
} from "../helpers/http";
import { rewardIdForSlug } from "../helpers/seed-rewards";

const SMOK = "Smok zjadł konia";

interface GmCell {
  position: number;
  phrase: string;
  reward_id: string | null;
  claimed_by_player_id: string | null;
  claimed_at: string | null;
  claimedByColor: number | null;
}

interface GmBoardBody {
  cells: GmCell[];
}

interface PlayerBoardCellDto {
  position: number;
  phrase: string;
}

interface PlayerBoardDto {
  cells: PlayerBoardCellDto[];
}

const emptySessionBody = {
  size: 3 as const,
  customPhrases: [] as { text: string; guaranteed: boolean }[],
  rewards: [] as { rewardId: string; count: number }[],
};

function phrasesOf(cells: { position: number; phrase: string }[]): string[] {
  return [...cells].sort((a, b) => a.position - b.position).map((cell) => cell.phrase);
}

function cellAt<T extends { position: number }>(cells: T[], position: number): T {
  const cell = cells.find((item) => item.position === position);
  expect(cell).toBeDefined();
  if (!cell) throw new Error(`missing cell at position ${position}`);
  return cell;
}

async function fetchGmCells(client: HttpClient, sessionId: string): Promise<GmCell[]> {
  const response = await client.request(`/api/sessions/${sessionId}/board`);
  expect(response.status).toBe(200);
  const cells = (response.body as GmBoardBody).cells;
  expect(Array.isArray(cells)).toBe(true);
  return [...cells].sort((a, b) => a.position - b.position);
}

async function fetchPlayerBoard(client: HttpClient, code: string): Promise<PlayerBoardDto> {
  const response = await client.request(`/api/play/board?code=${encodeURIComponent(code)}`);
  expect(response.status).toBe(200);
  return response.body as PlayerBoardDto;
}

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())("phrase reroll draw and commit", () => {
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

  it("draws a catalog phrase that is not visible and does not write", async () => {
    const { id } = await createActiveSession(gm, emptySessionBody);
    const before = await fetchGmCells(gm, id);
    const visible = new Set(before.map((cell) => normalizePhrase(cell.phrase)));

    const draw = await gm.request(`/api/sessions/${id}/reroll-phrase`, {
      method: "POST",
      json: { position: 0, overrides: [] },
    });
    expect(draw.status).toBe(200);
    const phrase = (draw.body as { phrase?: unknown }).phrase;
    expect(typeof phrase).toBe("string");
    if (typeof phrase !== "string") throw new Error("draw response missing phrase");
    expect(visible.has(normalizePhrase(phrase))).toBe(false);

    const after = await fetchGmCells(gm, id);
    expect(phrasesOf(after)).toEqual(phrasesOf(before));
  });

  it("refuses a draw on a claimed cell and writes nothing", async () => {
    const { id, code } = await createActiveSession(gm, emptySessionBody);
    const before = await fetchGmCells(gm, id);
    const player = createHttpClient(requireBaseUrl());
    await joinPlayer(player, { code, nick: "ClaimedDraw" });

    const claim = await player.request("/api/play/claim", {
      method: "POST",
      json: { code, position: 0 },
    });
    expect(claim.status).toBe(200);

    const draw = await gm.request(`/api/sessions/${id}/reroll-phrase`, {
      method: "POST",
      json: { position: 0, overrides: [] },
    });
    expect(draw.status).toBe(409);
    expect(draw.body).toMatchObject({ error: "Pole jest już zajęte", positions: [0] });

    const after = await fetchGmCells(gm, id);
    expect(phrasesOf(after)).toEqual(phrasesOf(before));
    expect(cellAt(after, 0).claimed_by_player_id).not.toBeNull();
  });

  it("commits a drawn phrase without changing reward_id or claim columns", async () => {
    const inspirationId = await rewardIdForSlug(gm, "inspiration");
    const { id, code } = await createActiveSession(gm, {
      size: 3,
      customPhrases: [],
      rewards: [{ rewardId: inspirationId, count: 1 }],
    });
    const before = await fetchGmCells(gm, id);
    const target = before.find((cell) => cell.reward_id === inspirationId && cell.claimed_by_player_id === null);
    expect(target).toBeDefined();
    if (!target) throw new Error("expected a free rewarded cell");

    const player = createHttpClient(requireBaseUrl());
    await joinPlayer(player, { code, nick: "PhraseWatch" });
    const playerBefore = await fetchPlayerBoard(player, code);
    expect(cellAt(playerBefore.cells, target.position).phrase).toBe(target.phrase);

    const draw = await gm.request(`/api/sessions/${id}/reroll-phrase`, {
      method: "POST",
      json: { position: target.position, overrides: [] },
    });
    expect(draw.status).toBe(200);
    const phrase = (draw.body as { phrase?: unknown }).phrase;
    expect(typeof phrase).toBe("string");
    if (typeof phrase !== "string") throw new Error("draw response missing phrase");

    const stillPublished = await fetchGmCells(gm, id);
    expect(cellAt(stillPublished, target.position).phrase).toBe(target.phrase);

    const commit = await gm.request(`/api/sessions/${id}/commit-phrase-rerolls`, {
      method: "POST",
      json: { changes: [{ position: target.position, phrase }] },
    });
    expect(commit.status).toBe(200);
    const committed = (commit.body as { cells?: GmCell[] }).cells?.find((cell) => cell.position === target.position);
    expect(committed?.phrase).toBe(phrase);
    expect(committed?.reward_id).toBe(inspirationId);
    expect(committed?.claimed_by_player_id).toBeNull();
    expect(committed?.claimed_at).toBeNull();

    const after = await fetchGmCells(gm, id);
    const updated = cellAt(after, target.position);
    expect(updated.phrase).toBe(phrase);
    expect(updated.reward_id).toBe(inspirationId);
    expect(updated.claimed_by_player_id).toBeNull();
    expect(updated.claimed_at).toBeNull();
    expect(updated.claimedByColor).toBeNull();

    const playerAfter = await fetchPlayerBoard(player, code);
    expect(cellAt(playerAfter.cells, target.position).phrase).toBe(phrase);
  });

  it("rejects a non-catalog phrase and writes nothing", async () => {
    const { id } = await createActiveSession(gm, {
      size: 3,
      customPhrases: [{ text: SMOK, guaranteed: true }],
      rewards: [],
    });
    const before = await fetchGmCells(gm, id);
    const home = before.find((cell) => cell.phrase === SMOK);
    const other = before.find((cell) => cell.phrase !== SMOK);
    expect(home).toBeDefined();
    expect(other).toBeDefined();
    if (!other) throw new Error("expected another cell");

    const commit = await gm.request(`/api/sessions/${id}/commit-phrase-rerolls`, {
      method: "POST",
      json: { changes: [{ position: other.position, phrase: SMOK }] },
    });
    expect(commit.status).toBe(400);

    const after = await fetchGmCells(gm, id);
    expect(phrasesOf(after)).toEqual(phrasesOf(before));
  });

  it("rejects a normalized duplicate and writes nothing", async () => {
    const { id } = await createActiveSession(gm, emptySessionBody);
    const before = await fetchGmCells(gm, id);
    const visible = cellAt(before, 0);
    const other = cellAt(before, 1);

    const commit = await gm.request(`/api/sessions/${id}/commit-phrase-rerolls`, {
      method: "POST",
      json: { changes: [{ position: other.position, phrase: visible.phrase }] },
    });
    expect(commit.status).toBe(409);

    const after = await fetchGmCells(gm, id);
    expect(phrasesOf(after)).toEqual(phrasesOf(before));
  });

  it("keeps every drafted phrase when one cell is claimed, then commits the rest", async () => {
    const { id, code } = await createActiveSession(gm, emptySessionBody);
    const before = await fetchGmCells(gm, id);

    const firstDraw = await gm.request(`/api/sessions/${id}/reroll-phrase`, {
      method: "POST",
      json: { position: 0, overrides: [] },
    });
    expect(firstDraw.status).toBe(200);
    const phrase0 = (firstDraw.body as { phrase?: unknown }).phrase;
    expect(typeof phrase0).toBe("string");
    if (typeof phrase0 !== "string") throw new Error("first draw missing phrase");

    const secondDraw = await gm.request(`/api/sessions/${id}/reroll-phrase`, {
      method: "POST",
      json: { position: 1, overrides: [{ position: 0, phrase: phrase0 }] },
    });
    expect(secondDraw.status).toBe(200);
    const phrase1 = (secondDraw.body as { phrase?: unknown }).phrase;
    expect(typeof phrase1).toBe("string");
    if (typeof phrase1 !== "string") throw new Error("second draw missing phrase");
    expect(normalizePhrase(phrase1)).not.toBe(normalizePhrase(phrase0));
    expect(before.some((cell) => normalizePhrase(cell.phrase) === normalizePhrase(phrase1))).toBe(false);

    const player = createHttpClient(requireBaseUrl());
    await joinPlayer(player, { code, nick: "RaceClaim" });
    const playerBefore = await fetchPlayerBoard(player, code);
    expect(cellAt(playerBefore.cells, 0).phrase).toBe(cellAt(before, 0).phrase);
    expect(cellAt(playerBefore.cells, 1).phrase).toBe(cellAt(before, 1).phrase);

    const claim = await player.request("/api/play/claim", {
      method: "POST",
      json: { code, position: 0 },
    });
    expect(claim.status).toBe(200);

    const rejected = await gm.request(`/api/sessions/${id}/commit-phrase-rerolls`, {
      method: "POST",
      json: {
        changes: [
          { position: 0, phrase: phrase0 },
          { position: 1, phrase: phrase1 },
        ],
      },
    });
    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({ error: "Pole jest już zajęte", positions: [0] });

    const unchanged = await fetchGmCells(gm, id);
    expect(phrasesOf(unchanged)).toEqual(phrasesOf(before));
    expect(cellAt(unchanged, 0).reward_id).toBe(cellAt(before, 0).reward_id);
    expect(cellAt(unchanged, 1).reward_id).toBe(cellAt(before, 1).reward_id);

    const committed = await gm.request(`/api/sessions/${id}/commit-phrase-rerolls`, {
      method: "POST",
      json: { changes: [{ position: 1, phrase: phrase1 }] },
    });
    expect(committed.status).toBe(200);

    const after = await fetchGmCells(gm, id);
    expect(cellAt(after, 0).phrase).toBe(cellAt(before, 0).phrase);
    expect(cellAt(after, 1).phrase).toBe(phrase1);
    expect(cellAt(after, 1).reward_id).toBe(cellAt(before, 1).reward_id);
    expect(cellAt(after, 1).claimed_by_player_id).toBeNull();

    const playerAfter = await fetchPlayerBoard(player, code);
    expect(cellAt(playerAfter.cells, 0).phrase).toBe(cellAt(before, 0).phrase);
    expect(cellAt(playerAfter.cells, 1).phrase).toBe(phrase1);
  });

  it("returns not found for a closed session", async () => {
    const source = await createActiveSession(gm, emptySessionBody);
    const created = await gm.request("/api/sessions", {
      method: "POST",
      json: { ...emptySessionBody, replaceSessionId: source.id },
    });
    expect(created.status).toBe(201);
    expect((created.body as { closeError?: string }).closeError).toBeUndefined();

    const draw = await gm.request(`/api/sessions/${source.id}/reroll-phrase`, {
      method: "POST",
      json: { position: 0, overrides: [] },
    });
    expect(draw.status).toBe(404);

    const commit = await gm.request(`/api/sessions/${source.id}/commit-phrase-rerolls`, {
      method: "POST",
      json: { changes: [{ position: 0, phrase: "Oswój zwierzę" }] },
    });
    expect(commit.status).toBe(404);
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

    it("returns not found for a non-owner", async () => {
      const { id } = await createActiveSession(gm, emptySessionBody);

      const draw = await otherGm.request(`/api/sessions/${id}/reroll-phrase`, {
        method: "POST",
        json: { position: 0, overrides: [] },
      });
      expect(draw.status).toBe(404);

      const commit = await otherGm.request(`/api/sessions/${id}/commit-phrase-rerolls`, {
        method: "POST",
        json: { changes: [{ position: 0, phrase: "Oswój zwierzę" }] },
      });
      expect(commit.status).toBe(404);

      const board = await gm.request(`/api/sessions/${id}/board`);
      expect(board.status).toBe(200);
      expect((board.body as { status?: string }).status).toBe("active");
    });
  });
});
