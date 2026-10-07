import { beforeAll, describe, expect, it } from "vitest";
import { PLAYER_COOKIE_NAME, readPlayerIdentity } from "@/lib/player-cookie";
import {
  createActiveSession,
  createHttpClient,
  forgePlayerCookie,
  hasBaseUrl,
  joinPlayer,
  resolveSecondTestCredentials,
  resolveTestCredentials,
  requireBaseUrl,
  type HttpClient,
} from "../helpers/http";

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

function cellAt(board: PlayerBoardDto, position: number): PlayerBoardCellDto {
  const cell = board.cells.find((c) => c.position === position);
  expect(cell).toBeDefined();
  if (!cell) throw new Error(`missing cell at position ${position}`);
  return cell;
}

async function fetchPlayerBoard(client: HttpClient, code: string): Promise<PlayerBoardDto> {
  const res = await client.request(`/api/play/board?code=${encodeURIComponent(code)}`);
  expect(res.status).toBe(200);
  return res.body as PlayerBoardDto;
}

function assertErrorBody(body: unknown): void {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  if (typeof body !== "object" || body === null || !("error" in body)) {
    throw new Error("expected JSON body with error field");
  }
  const error = body.error;
  expect(typeof error).toBe("string");
  expect((error as string).trim().length).toBeGreaterThan(0);
}

function assertNoProtectedBoardPayload(body: unknown, opts: { sessionCode: string; samplePhrases: string[] }): void {
  assertErrorBody(body);
  if (typeof body === "object" && body !== null) {
    expect(body).not.toHaveProperty("cells");
    expect(body).not.toHaveProperty("code");
    expect(body).not.toHaveProperty("players");
  }
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(opts.sessionCode);
  for (const phrase of opts.samplePhrases) {
    if (phrase.length >= 4) {
      expect(serialized).not.toContain(phrase);
    }
  }
}

const emptySessionBody = {
  size: 3 as const,
  customPhrases: [],
  rewards: [],
};

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials())("Abuse / join identity (Risks #6 #8)", () => {
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

  it("#6 live forged player cookie on active session → claim 401 and cell stays free", async () => {
    const { code } = await createActiveSession(gm, emptySessionBody);
    const position = 0;

    const observer = createHttpClient(requireBaseUrl());
    const before = await fetchPlayerBoard(observer, code);
    expect(cellAt(before, position).claimedByColor).toBeNull();

    const attacker = createHttpClient(requireBaseUrl());
    attacker.jar.set(PLAYER_COOKIE_NAME, forgePlayerCookie(code));
    const claim = await attacker.request("/api/play/claim", {
      method: "POST",
      json: { code, position },
    });
    expect(claim.status).toBe(401);
    assertErrorBody(claim.body);

    const after = await fetchPlayerBoard(observer, code);
    expect(cellAt(after, position).claimedByColor).toBeNull();
  });

  it("#6 cross-code claim with session A token in session B cookie slot → 401 and B unchanged", async () => {
    const sessionA = await createActiveSession(gm, emptySessionBody);
    const sessionB = await createActiveSession(gm, emptySessionBody);
    const position = 0;

    const playerA = createHttpClient(requireBaseUrl());
    await joinPlayer(playerA, { code: sessionA.code, nick: "CrossA" });
    const cookieRaw = playerA.jar.get(PLAYER_COOKIE_NAME);
    expect(cookieRaw).toBeDefined();
    const identity = readPlayerIdentity(cookieRaw, sessionA.code);
    expect(identity).not.toBeNull();
    if (!identity) throw new Error("expected identity after join");

    const observer = createHttpClient(requireBaseUrl());
    const beforeB = await fetchPlayerBoard(observer, sessionB.code);
    expect(cellAt(beforeB, position).claimedByColor).toBeNull();

    const attacker = createHttpClient(requireBaseUrl());
    attacker.jar.set(
      PLAYER_COOKIE_NAME,
      forgePlayerCookie(sessionB.code, {
        playerId: identity.playerId,
        claimToken: identity.claimToken,
        nick: identity.nick,
        color: identity.color,
      }),
    );
    const claim = await attacker.request("/api/play/claim", {
      method: "POST",
      json: { code: sessionB.code, position },
    });
    expect(claim.status).toBe(401);
    assertErrorBody(claim.body);

    const afterB = await fetchPlayerBoard(observer, sessionB.code);
    expect(cellAt(afterB, position).claimedByColor).toBeNull();
  });

  it("#8 anonymous live GM board API → 401 without protected payload", async () => {
    const { id, code } = await createActiveSession(gm, emptySessionBody);

    const ownerBoard = await gm.request(`/api/sessions/${id}/board`);
    expect(ownerBoard.status).toBe(200);
    const ownerCells = (ownerBoard.body as { cells: { phrase: string }[] }).cells;
    expect(ownerCells.length).toBeGreaterThan(0);
    const samplePhrases = ownerCells.slice(0, 3).map((c) => c.phrase);

    const anon = createHttpClient(requireBaseUrl());
    const denied = await anon.request(`/api/sessions/${id}/board`);
    expect(denied.status).toBe(401);
    assertNoProtectedBoardPayload(denied.body, { sessionCode: code, samplePhrases });
  });

  it("#8 anonymous session page → 302 redirect to sign-in", async () => {
    const { id } = await createActiveSession(gm, emptySessionBody);

    const anon = createHttpClient(requireBaseUrl());
    const page = await anon.request(`/sessions/${id}`);
    expect(page.status).toBe(302);
    expect(page.location).toBe("/auth/signin");
  });

  describe.skipIf(!resolveSecondTestCredentials())("#6 cross-owner GM APIs", () => {
    let otherGm: HttpClient;

    beforeAll(async () => {
      const second = resolveSecondTestCredentials();
      expect(second).not.toBeNull();
      if (!second) {
        throw new Error("TEST_EMAIL_B / TEST_PASSWORD_B required for cross-owner abuse tests");
      }
      otherGm = createHttpClient(requireBaseUrl());
      const signIn = await otherGm.signIn(second.email, second.password);
      expect(signIn.status).toBe(200);
    });

    it("#6 other GM cannot read or undo owner session → 404; owner board still 200", async () => {
      const { id } = await createActiveSession(gm, emptySessionBody);

      const foreignBoard = await otherGm.request(`/api/sessions/${id}/board`);
      expect(foreignBoard.status).toBe(404);
      assertErrorBody(foreignBoard.body);

      const foreignUndo = await otherGm.request(`/api/sessions/${id}/undo-claim`, {
        method: "POST",
        json: { position: 0 },
      });
      expect(foreignUndo.status).toBe(404);
      assertErrorBody(foreignUndo.body);

      const ownerBoard = await gm.request(`/api/sessions/${id}/board`);
      expect(ownerBoard.status).toBe(200);
      const cells = (ownerBoard.body as { cells: unknown[] }).cells;
      expect(Array.isArray(cells)).toBe(true);
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});
