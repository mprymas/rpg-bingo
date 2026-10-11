import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/db/database.types";
import { createHttpClient, hasBaseUrl, resolveTestCredentials, requireBaseUrl, type HttpClient } from "../helpers/http";
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
