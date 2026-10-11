import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/database.types";
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

/** Valid UUID shape that is not expected in the seeded rewards catalog. */
const UNKNOWN_REWARD_ID = "00000000-0000-4000-8000-000000000099";

function envValue(name: string): string {
  if (process.env[name]) return process.env[name];
  try {
    const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      if (trimmed.slice(0, eq).trim() !== name) continue;
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch {
    return "";
  }
  return "";
}

function hasSupabaseEnv(): boolean {
  return Boolean(envValue("SUPABASE_URL") && envValue("SUPABASE_KEY"));
}

async function gmSupabase(email: string, password: string): Promise<SupabaseClient<Database>> {
  const url = envValue("SUPABASE_URL");
  const key = envValue("SUPABASE_KEY");
  const client = createClient<Database>(url, key);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials() || !hasSupabaseEnv())(
  "POST /api/sessions — threshold & line reward rules (create)",
  () => {
    let http: HttpClient;
    let credentials: { email: string; password: string };
    let inspirationId: string;
    let itemId: string;

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
      inspirationId = await rewardIdForSlug(http, "inspiration");
      itemId = await rewardIdForSlug(http, "item");
    });

    it("stores board_lines, pool rows, and threshold_count when rules are set", async () => {
      const size = 3 as const;
      const lineIds = [inspirationId, itemId];
      const thresholdIds = [inspirationId];
      const thresholdCount = 2;

      const created = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size,
          customPhrases: [],
          rewards: [],
          lineRewardIds: lineIds,
          thresholdRewardIds: thresholdIds,
          thresholdCount,
        },
      });
      expect(created.status).toBe(201);
      const body = created.body as { id?: string };
      expect(typeof body.id).toBe("string");
      if (typeof body.id !== "string") throw new Error("create response missing id");

      const sb = await gmSupabase(credentials.email, credentials.password);

      const { data: session, error: sessionError } = await sb
        .from("sessions")
        .select("threshold_count")
        .eq("id", body.id)
        .single();
      expect(sessionError).toBeNull();
      expect(session?.threshold_count).toBe(thresholdCount);

      const { data: pool, error: poolError } = await sb
        .from("session_reward_pool")
        .select("kind, reward_id")
        .eq("session_id", body.id);
      expect(poolError).toBeNull();
      expect(pool).toHaveLength(lineIds.length + thresholdIds.length);
      const poolLineIds = (pool ?? [])
        .filter((r) => r.kind === "line")
        .map((r) => r.reward_id)
        .sort();
      const poolThresholdIds = (pool ?? [])
        .filter((r) => r.kind === "threshold")
        .map((r) => r.reward_id)
        .sort();
      expect(poolLineIds).toEqual([...lineIds].sort());
      expect(poolThresholdIds).toEqual([...thresholdIds].sort());

      const { data: lines, error: linesError } = await sb
        .from("board_lines")
        .select("axis, index, reward_id")
        .eq("session_id", body.id);
      expect(linesError).toBeNull();
      expect(lines).toHaveLength(2 * size);
      const allowed = new Set(lineIds);
      for (const line of lines ?? []) {
        expect(allowed.has(line.reward_id)).toBe(true);
        expect(line.axis === "row" || line.axis === "column").toBe(true);
        expect(line.index).toBeGreaterThanOrEqual(0);
        expect(line.index).toBeLessThan(size);
      }
      const rowCount = (lines ?? []).filter((l) => l.axis === "row").length;
      const colCount = (lines ?? []).filter((l) => l.axis === "column").length;
      expect(rowCount).toBe(size);
      expect(colCount).toBe(size);
    });

    it("rejects unknown line/threshold reward id with 400", async () => {
      const unknownLine = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size: 3,
          customPhrases: [],
          rewards: [],
          lineRewardIds: [UNKNOWN_REWARD_ID],
          thresholdRewardIds: [],
          thresholdCount: null,
        },
      });
      expect(unknownLine.status).toBe(400);

      const unknownThreshold = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size: 3,
          customPhrases: [],
          rewards: [],
          lineRewardIds: [],
          thresholdRewardIds: [UNKNOWN_REWARD_ID],
          thresholdCount: 2,
        },
      });
      expect(unknownThreshold.status).toBe(400);
    });

    it("rejects threshold ids with thresholdCount 0 or > size² with 400", async () => {
      const zero = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size: 3,
          customPhrases: [],
          rewards: [],
          lineRewardIds: [],
          thresholdRewardIds: [inspirationId],
          thresholdCount: 0,
        },
      });
      expect(zero.status).toBe(400);

      const tooHigh = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size: 3,
          customPhrases: [],
          rewards: [],
          lineRewardIds: [],
          thresholdRewardIds: [inspirationId],
          thresholdCount: 10,
        },
      });
      expect(tooHigh.status).toBe(400);
    });

    it("creates a rule-less session when new fields are omitted (backward compat)", async () => {
      const created = await http.request("/api/sessions", {
        method: "POST",
        json: {
          size: 3,
          customPhrases: [],
          rewards: [],
        },
      });
      expect(created.status).toBe(201);
      const body = created.body as { id?: string };
      expect(typeof body.id).toBe("string");
      if (typeof body.id !== "string") throw new Error("create response missing id");

      const sb = await gmSupabase(credentials.email, credentials.password);
      const { data: session, error: sessionError } = await sb
        .from("sessions")
        .select("threshold_count")
        .eq("id", body.id)
        .single();
      expect(sessionError).toBeNull();
      expect(session?.threshold_count).toBeNull();

      const { data: pool, error: poolError } = await sb
        .from("session_reward_pool")
        .select("kind")
        .eq("session_id", body.id);
      expect(poolError).toBeNull();
      expect(pool).toEqual([]);

      const { data: lines, error: linesError } = await sb.from("board_lines").select("axis").eq("session_id", body.id);
      expect(linesError).toBeNull();
      expect(lines).toEqual([]);
    });
  },
);

interface PlayerRewardProgressDto {
  claimedCount: number;
  thresholdCount: number | null;
  thresholdReward: { slug: string; label: string } | null;
  lines: { axis: string; index: number; reward: { slug: string; label: string } }[];
}

interface PlayerBoardDto {
  code: string;
  size: number;
  cells: {
    position: number;
    hasReward: boolean;
    reward: { slug: string; label: string } | null;
    claimedByColor: number | null;
  }[];
  progress: PlayerRewardProgressDto | null;
}

interface ClaimSuccessBody {
  cell: { position: number; reward: { slug: string; label: string } | null; claimedByColor: number | null };
  progress: PlayerRewardProgressDto | null;
}

interface GmBoardDto {
  players: {
    id: string;
    nick: string;
    earned: {
      claimedCount: number;
      thresholdReward: { slug: string; label: string } | null;
      lines: { axis: string; index: number; reward: { slug: string; label: string } }[];
    };
  }[];
  rewardRules: {
    thresholdCount: number | null;
    thresholdRewardIds: string[];
    lineRewardIds: string[];
  };
}

async function fetchPlayerBoard(client: HttpClient, code: string): Promise<PlayerBoardDto> {
  const res = await client.request(`/api/play/board?code=${encodeURIComponent(code)}`);
  expect(res.status).toBe(200);
  return res.body as PlayerBoardDto;
}

async function fetchGmBoard(client: HttpClient, sessionId: string): Promise<GmBoardDto> {
  const res = await client.request(`/api/sessions/${sessionId}/board`);
  expect(res.status).toBe(200);
  return res.body as GmBoardDto;
}

function earnedByNick(board: GmBoardDto, nick: string) {
  const player = board.players.find((p) => p.nick === nick);
  expect(player, `expected GM roster entry for ${nick}`).toBeDefined();
  if (!player) throw new Error(`missing roster entry ${nick}`);
  return player.earned;
}

describe.skipIf(!hasBaseUrl() || !resolveTestCredentials() || !hasSupabaseEnv())(
  "threshold & line rewards — join / claim / undo progress",
  () => {
    let gm: HttpClient;
    let credentials: { email: string; password: string };
    let inspirationId: string;
    let itemId: string;

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
      inspirationId = await rewardIdForSlug(gm, "inspiration");
      itemId = await rewardIdForSlug(gm, "item");
    });

    it("join draws threshold_reward_id from the pool; rejoin keeps it", async () => {
      const { id, code } = await createActiveSession(gm, {
        size: 3,
        customPhrases: [],
        rewards: [],
        lineRewardIds: [],
        thresholdRewardIds: [inspirationId, itemId],
        thresholdCount: 2,
      });

      const player = createHttpClient(requireBaseUrl());
      await joinPlayer(player, { code, nick: "ThreshJoin" });

      const sb = await gmSupabase(credentials.email, credentials.password);
      const { data: seat, error } = await sb
        .from("session_players")
        .select("id, threshold_reward_id")
        .eq("session_id", id)
        .eq("nick", "ThreshJoin")
        .single();
      expect(error).toBeNull();
      expect(seat).not.toBeNull();
      if (!seat) throw new Error("expected session_players seat");
      expect(seat.threshold_reward_id).toBeTruthy();
      expect([inspirationId, itemId]).toContain(seat.threshold_reward_id);
      const drawn = seat.threshold_reward_id;
      if (!drawn) throw new Error("expected threshold_reward_id");

      await joinPlayer(player, { code, nick: "ThreshJoin" });

      const { data: reseat, error: reseatError } = await sb
        .from("session_players")
        .select("threshold_reward_id")
        .eq("id", seat.id)
        .single();
      expect(reseatError).toBeNull();
      expect(reseat?.threshold_reward_id).toBe(drawn);
    });

    it("derives threshold + row rewards on claim, undoes, and restores on reclaim", async () => {
      const { id, code } = await createActiveSession(gm, {
        size: 3,
        customPhrases: [],
        rewards: [],
        lineRewardIds: [inspirationId, itemId],
        thresholdRewardIds: [inspirationId],
        thresholdCount: 2,
      });

      const sb = await gmSupabase(credentials.email, credentials.password);
      const { data: row0, error: rowError } = await sb
        .from("board_lines")
        .select("reward_id, reward:rewards ( slug, label )")
        .eq("session_id", id)
        .eq("axis", "row")
        .eq("index", 0)
        .single();
      expect(rowError).toBeNull();
      expect(row0?.reward).toBeTruthy();
      const row0Reward = row0?.reward as { slug: string; label: string };
      expect(typeof row0Reward.slug).toBe("string");

      const anna = createHttpClient(requireBaseUrl());
      const borin = createHttpClient(requireBaseUrl());
      await joinPlayer(anna, { code, nick: "Anna" });
      await joinPlayer(borin, { code, nick: "Borin" });

      const claim0 = await anna.request("/api/play/claim", { method: "POST", json: { code, position: 0 } });
      expect(claim0.status).toBe(200);
      const progressAfter0 = (claim0.body as ClaimSuccessBody).progress;
      expect(progressAfter0).not.toBeNull();
      expect(progressAfter0?.claimedCount).toBe(1);
      expect(progressAfter0?.thresholdCount).toBe(2);
      expect(progressAfter0?.thresholdReward).toBeNull();
      expect(progressAfter0?.lines).toEqual([]);

      const claim1 = await anna.request("/api/play/claim", { method: "POST", json: { code, position: 1 } });
      expect(claim1.status).toBe(200);
      const progressAfter1 = (claim1.body as ClaimSuccessBody).progress;
      expect(progressAfter1?.claimedCount).toBe(2);
      expect(progressAfter1?.thresholdReward).not.toBeNull();
      expect(progressAfter1?.thresholdReward?.slug).toBe("inspiration");
      expect(progressAfter1?.lines).toEqual([]);

      const claim2 = await borin.request("/api/play/claim", { method: "POST", json: { code, position: 2 } });
      expect(claim2.status).toBe(200);
      const borinProgress = (claim2.body as ClaimSuccessBody).progress;
      expect(borinProgress?.claimedCount).toBe(1);
      expect(borinProgress?.thresholdReward).toBeNull();
      expect(borinProgress?.lines).toHaveLength(1);
      expect(borinProgress?.lines[0]).toMatchObject({
        axis: "row",
        index: 0,
        reward: { slug: row0Reward.slug, label: row0Reward.label },
      });

      const annaBoard = await fetchPlayerBoard(anna, code);
      expect(annaBoard.progress?.thresholdReward?.slug).toBe("inspiration");
      expect(annaBoard.progress?.lines).toEqual([]);

      const borinBoard = await fetchPlayerBoard(borin, code);
      expect(borinBoard.progress?.thresholdReward).toBeNull();
      expect(borinBoard.progress?.lines).toHaveLength(1);

      const gmAfterClaims = await fetchGmBoard(gm, id);
      expect(earnedByNick(gmAfterClaims, "Anna").thresholdReward?.slug).toBe("inspiration");
      expect(earnedByNick(gmAfterClaims, "Anna").lines).toEqual([]);
      expect(earnedByNick(gmAfterClaims, "Borin").thresholdReward).toBeNull();
      expect(earnedByNick(gmAfterClaims, "Borin").lines).toMatchObject([
        { axis: "row", index: 0, reward: { slug: row0Reward.slug } },
      ]);

      const undo = await gm.request(`/api/sessions/${id}/undo-claim`, {
        method: "POST",
        json: { position: 1 },
      });
      expect(undo.status).toBe(200);

      const annaAfterUndo = await fetchPlayerBoard(anna, code);
      expect(annaAfterUndo.progress?.claimedCount).toBe(1);
      expect(annaAfterUndo.progress?.thresholdReward).toBeNull();
      expect(annaAfterUndo.progress?.lines).toEqual([]);

      const borinAfterUndo = await fetchPlayerBoard(borin, code);
      expect(borinAfterUndo.progress?.lines).toEqual([]);

      const gmAfterUndo = await fetchGmBoard(gm, id);
      expect(earnedByNick(gmAfterUndo, "Anna").thresholdReward).toBeNull();
      expect(earnedByNick(gmAfterUndo, "Borin").lines).toEqual([]);

      const reclaim = await anna.request("/api/play/claim", { method: "POST", json: { code, position: 1 } });
      expect(reclaim.status).toBe(200);
      const reclaimProgress = (reclaim.body as ClaimSuccessBody).progress;
      expect(reclaimProgress?.thresholdReward?.slug).toBe("inspiration");
      expect(reclaimProgress?.lines).toHaveLength(1);
      expect(reclaimProgress?.lines[0]).toMatchObject({
        axis: "row",
        index: 0,
        reward: { slug: row0Reward.slug, label: row0Reward.label },
      });

      const borinAfterReclaim = await fetchPlayerBoard(borin, code);
      expect(borinAfterReclaim.progress?.lines).toEqual([]);

      const gmAfterReclaim = await fetchGmBoard(gm, id);
      expect(earnedByNick(gmAfterReclaim, "Anna").thresholdReward?.slug).toBe("inspiration");
      expect(earnedByNick(gmAfterReclaim, "Anna").lines).toMatchObject([
        { axis: "row", index: 0, reward: { slug: row0Reward.slug } },
      ]);
      expect(earnedByNick(gmAfterReclaim, "Borin").lines).toEqual([]);
    });

    it("hides unearned line and threshold rewards in player progress", async () => {
      const { code } = await createActiveSession(gm, {
        size: 3,
        customPhrases: [],
        rewards: [],
        lineRewardIds: [inspirationId],
        thresholdRewardIds: [itemId],
        thresholdCount: 3,
      });

      const player = createHttpClient(requireBaseUrl());
      await joinPlayer(player, { code, nick: "Hidden" });

      const claim = await player.request("/api/play/claim", { method: "POST", json: { code, position: 0 } });
      expect(claim.status).toBe(200);
      const progress = (claim.body as ClaimSuccessBody).progress;
      expect(progress).not.toBeNull();
      expect(progress?.claimedCount).toBe(1);
      expect(progress?.thresholdCount).toBe(3);
      expect(progress?.thresholdReward).toBeNull();
      expect(progress?.lines).toEqual([]);

      const board = await fetchPlayerBoard(player, code);
      expect(board.progress?.thresholdReward).toBeNull();
      expect(board.progress?.lines).toEqual([]);
    });

    it("rule-less session keeps progress null and empty roster earned; per-field reveal unchanged", async () => {
      const { id, code } = await createActiveSession(gm, {
        size: 3,
        customPhrases: [],
        rewards: [{ rewardId: inspirationId, count: 1 }],
      });

      const player = createHttpClient(requireBaseUrl());
      await joinPlayer(player, { code, nick: "RuleLess" });

      const before = await fetchPlayerBoard(player, code);
      expect(before.progress).toBeNull();
      const mystery = before.cells.find((c) => c.hasReward && c.reward === null && c.claimedByColor === null);
      expect(mystery, "expected a free rewarded mystery cell").toBeDefined();
      if (!mystery) throw new Error("expected free rewarded mystery cell");

      const claim = await player.request("/api/play/claim", {
        method: "POST",
        json: { code, position: mystery.position },
      });
      expect(claim.status).toBe(200);
      const claimed = claim.body as ClaimSuccessBody;
      expect(claimed.progress).toBeNull();
      expect(claimed.cell.reward).not.toBeNull();
      expect(claimed.cell.reward?.slug).toBe("inspiration");

      const after = await fetchPlayerBoard(player, code);
      expect(after.progress).toBeNull();
      const persisted = after.cells.find((c) => c.position === mystery.position);
      expect(persisted?.reward?.slug).toBe("inspiration");

      const gmBoard = await fetchGmBoard(gm, id);
      expect(gmBoard.rewardRules).toEqual({
        thresholdCount: null,
        thresholdRewardIds: [],
        lineRewardIds: [],
      });
      for (const entry of gmBoard.players) {
        expect(entry.earned.thresholdReward).toBeNull();
        expect(entry.earned.lines).toEqual([]);
      }
    });
  },
);
