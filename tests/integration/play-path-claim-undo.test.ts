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
import { rewardIdForSlug } from "../helpers/seed-rewards";

interface PlayerBoardCellDto {
  position: number;
  phrase: string;
  hasReward: boolean;
  reward: { slug: string; label: string } | null;
  claimedByColor: number | null;
}

interface PlayerBoardDto {
  code: string;
  size: number;
  cells: PlayerBoardCellDto[];
  players: { nick: string; color: number; created_at: string }[];
}

interface ClaimSuccessBody {
  cell: PlayerBoardCellDto;
}

interface ClaimConflictBody {
  error: string;
  occupant: { nick: string; color: number };
  cell: PlayerBoardCellDto;
}

interface UndoClaimBody {
  cell: {
    position: number;
    reward_id: string | null;
    claimed_by_player_id: string | null;
    claimedByColor: number | null;
  };
}

function cellAt(board: PlayerBoardDto, position: number): PlayerBoardCellDto {
  const cell = board.cells.find((c) => c.position === position);
  expect(cell).toBeDefined();
  if (!cell) throw new Error(`missing cell at position ${position}`);
  return cell;
}

function findMysteryRewardCell(board: PlayerBoardDto): PlayerBoardCellDto {
  const cell = board.cells.find((c) => c.hasReward && c.reward === null && c.claimedByColor === null);
  expect(cell, "expected a free rewarded mystery cell (catalog/seed reward placement)").toBeDefined();
  if (!cell) throw new Error("expected free rewarded mystery cell");
  return cell;
}

async function fetchPlayerBoard(client: HttpClient, code: string): Promise<PlayerBoardDto> {
  const res = await client.request(`/api/play/board?code=${encodeURIComponent(code)}`);
  expect(res.status).toBe(200);
  return res.body as PlayerBoardDto;
}

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())("Play-path claim / undo (Risks #3 #4 #5 #7)", () => {
  let gm: HttpClient;
  let credentials: { email: string; password: string };

  beforeAll(async () => {
    const resolved = resolveTestCredentials();
    expect(resolved).not.toBeNull();
    if (!resolved) {
      throw new Error("TEST_/SMOKE_ credentials required for authenticated integration tests");
    }
    credentials = resolved;
    gm = createHttpClient(requireBaseUrl());
    const signIn = await gm.signIn(credentials.email, credentials.password);
    expect(signIn.status).toBe(200);
  });

  it("#3 parallel dual-client claim race → one 200 and one 409 conflict", async () => {
    const { code } = await createActiveSession(gm, {
      size: 3,
      customPhrases: [],
      rewards: [],
    });

    const baseUrl = requireBaseUrl();
    const anna = createHttpClient(baseUrl);
    const borin = createHttpClient(baseUrl);
    await joinPlayer(anna, { code, nick: "Anna" });
    await joinPlayer(borin, { code, nick: "Borin" });

    const position = 0;
    const [annaClaim, borinClaim] = await Promise.all([
      anna.request("/api/play/claim", { method: "POST", json: { code, position } }),
      borin.request("/api/play/claim", { method: "POST", json: { code, position } }),
    ]);

    const statuses = [annaClaim.status, borinClaim.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const winner = annaClaim.status === 200 ? annaClaim : borinClaim;
    const loser = annaClaim.status === 409 ? annaClaim : borinClaim;
    const winnerNick = annaClaim.status === 200 ? "Anna" : "Borin";

    const success = winner.body as ClaimSuccessBody;
    expect(success.cell.position).toBe(position);
    expect(typeof success.cell.claimedByColor).toBe("number");
    expect(success.cell.claimedByColor).toBeGreaterThanOrEqual(1);

    const conflict = loser.body as ClaimConflictBody;
    expect(conflict.error).toBe("conflict");
    expect(conflict.occupant.nick).toBe(winnerNick);
    expect(typeof conflict.occupant.color).toBe("number");
    expect(conflict.occupant.color).toBeGreaterThanOrEqual(1);
    expect(conflict.cell.position).toBe(position);
    expect(typeof conflict.cell.claimedByColor).toBe("number");

    const board = await fetchPlayerBoard(anna, code);
    const claimed = cellAt(board, position);
    expect(typeof claimed.claimedByColor).toBe("number");
    expect(claimed.claimedByColor).toBeGreaterThanOrEqual(1);
    const claimedColors = board.cells.filter((c) => c.claimedByColor != null).map((c) => c.claimedByColor);
    expect(claimedColors).toHaveLength(1);
  });

  it("#4 mystery reward → claim reveal → board persistence", async () => {
    const inspirationId = await rewardIdForSlug(gm, "inspiration");
    const { code } = await createActiveSession(gm, {
      size: 3,
      customPhrases: [],
      rewards: [{ rewardId: inspirationId, count: 1 }],
    });

    const player = createHttpClient(requireBaseUrl());
    await joinPlayer(player, { code, nick: "RewardSeek" });

    const before = await fetchPlayerBoard(player, code);
    const mystery = findMysteryRewardCell(before);
    expect(mystery.hasReward).toBe(true);
    expect(mystery.reward).toBeNull();
    expect(mystery.claimedByColor).toBeNull();

    const claim = await player.request("/api/play/claim", {
      method: "POST",
      json: { code, position: mystery.position },
    });
    expect(claim.status).toBe(200);
    const claimed = (claim.body as ClaimSuccessBody).cell;
    expect(claimed.position).toBe(mystery.position);
    expect(claimed.hasReward).toBe(true);
    expect(claimed.reward).not.toBeNull();
    expect(typeof claimed.reward?.label).toBe("string");
    expect(claimed.reward?.label.trim().length).toBeGreaterThan(0);
    expect(typeof claimed.claimedByColor).toBe("number");

    const after = await fetchPlayerBoard(player, code);
    const persisted = cellAt(after, mystery.position);
    expect(persisted.claimedByColor).toBe(claimed.claimedByColor);
    expect(persisted.reward).not.toBeNull();
    expect(persisted.reward?.label).toBe(claimed.reward?.label);
    expect(persisted.hasReward).toBe(true);

    const page = await player.request(`/play/${encodeURIComponent(code)}`);
    expect(page.status).toBe(200);
    expect(typeof page.body).toBe("string");
    expect(page.body as string).toContain(mystery.phrase);
  });

  it("#5 cookie jar recovers board and form rejoin keeps seat", async () => {
    const { code } = await createActiveSession(gm, {
      size: 3,
      customPhrases: [],
      rewards: [],
    });

    const player = createHttpClient(requireBaseUrl());
    await joinPlayer(player, { code, nick: "RejoinMe" });

    const claim = await player.request("/api/play/claim", {
      method: "POST",
      json: { code, position: 0 },
    });
    expect(claim.status).toBe(200);
    const claimedColor = (claim.body as ClaimSuccessBody).cell.claimedByColor;
    expect(typeof claimedColor).toBe("number");

    const boardViaApi = await fetchPlayerBoard(player, code);
    expect(cellAt(boardViaApi, 0).claimedByColor).toBe(claimedColor);
    expect(boardViaApi.players.some((p) => p.nick === "RejoinMe")).toBe(true);

    const page = await player.request(`/play/${encodeURIComponent(code)}`);
    expect(page.status).toBe(200);
    expect(typeof page.body).toBe("string");
    expect(page.body as string).toContain("RejoinMe");

    // Same jar rejoin — no cookie clear; seat stays authorized.
    await joinPlayer(player, { code, nick: "RejoinMe" });

    const afterRejoin = await fetchPlayerBoard(player, code);
    expect(cellAt(afterRejoin, 0).claimedByColor).toBe(claimedColor);
    expect(afterRejoin.players.some((p) => p.nick === "RejoinMe")).toBe(true);

    const reclaimOther = await player.request("/api/play/claim", {
      method: "POST",
      json: { code, position: 1 },
    });
    expect(reclaimOther.status).toBe(200);
    expect(typeof (reclaimOther.body as ClaimSuccessBody).cell.claimedByColor).toBe("number");
  });

  it("#7 claim → GM undo → mystery restored → reclaim", async () => {
    const inspirationId = await rewardIdForSlug(gm, "inspiration");
    const { id, code } = await createActiveSession(gm, {
      size: 3,
      customPhrases: [],
      rewards: [{ rewardId: inspirationId, count: 1 }],
    });

    const player = createHttpClient(requireBaseUrl());
    await joinPlayer(player, { code, nick: "UndoSeek" });

    const before = await fetchPlayerBoard(player, code);
    const mystery = findMysteryRewardCell(before);

    const claim = await player.request("/api/play/claim", {
      method: "POST",
      json: { code, position: mystery.position },
    });
    expect(claim.status).toBe(200);
    expect((claim.body as ClaimSuccessBody).cell.reward).not.toBeNull();

    const undo = await gm.request(`/api/sessions/${id}/undo-claim`, {
      method: "POST",
      json: { position: mystery.position },
    });
    expect(undo.status).toBe(200);
    const undone = (undo.body as UndoClaimBody).cell;
    expect(undone.position).toBe(mystery.position);
    expect(undone.claimedByColor).toBeNull();
    expect(undone.claimed_by_player_id).toBeNull();
    expect(undone.reward_id).toBe(inspirationId);

    const gmBoard = await gm.request(`/api/sessions/${id}/board`);
    expect(gmBoard.status).toBe(200);
    const gmCells = (gmBoard.body as { cells: { position: number; reward_id: string | null }[] }).cells;
    const gmCell = gmCells.find((c) => c.position === mystery.position);
    expect(gmCell?.reward_id).toBe(inspirationId);

    const playerAfterUndo = await fetchPlayerBoard(player, code);
    const freed = cellAt(playerAfterUndo, mystery.position);
    expect(freed.claimedByColor).toBeNull();
    expect(freed.reward).toBeNull();
    expect(freed.hasReward).toBe(true);

    const reclaim = await player.request("/api/play/claim", {
      method: "POST",
      json: { code, position: mystery.position },
    });
    expect(reclaim.status).toBe(200);
    const reclaimed = (reclaim.body as ClaimSuccessBody).cell;
    expect(reclaimed.position).toBe(mystery.position);
    expect(typeof reclaimed.claimedByColor).toBe("number");
    expect(reclaimed.reward).not.toBeNull();
    expect(typeof reclaimed.reward?.label).toBe("string");
  });
});
