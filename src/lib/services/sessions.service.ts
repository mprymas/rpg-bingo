import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { generateBoard } from "@/lib/services/board-generator";
import { generateSessionCode } from "@/lib/services/session-code";
import type { CreateSessionCommand, CreateSessionResponse, PlayerBoard, Session, SessionWithCells } from "@/types";

type AppSupabaseClient = SupabaseClient<Database>;

export type SessionServiceErrorCode = "UNKNOWN_REWARD" | "CODE_COLLISION";

export class SessionServiceError extends Error {
  readonly code: SessionServiceErrorCode;

  constructor(code: SessionServiceErrorCode) {
    super(code);
    this.name = "SessionServiceError";
    this.code = code;
  }
}

const MAX_CODE_ATTEMPTS = 5;

export async function createSession(
  supabase: AppSupabaseClient,
  command: CreateSessionCommand,
): Promise<CreateSessionResponse> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw userError ?? new Error("Authenticated user required");
  }

  const [{ data: phrases, error: phrasesError }, { data: rewards, error: rewardsError }] = await Promise.all([
    supabase.from("phrases").select("text"),
    supabase.from("rewards").select("id"),
  ]);

  if (phrasesError) throw phrasesError;
  if (rewardsError) throw rewardsError;

  const rewardIds = new Set(rewards.map((r) => r.id));
  for (const { rewardId } of command.rewards) {
    if (!rewardIds.has(rewardId)) {
      throw new SessionServiceError("UNKNOWN_REWARD");
    }
  }

  const generatedCells = generateBoard({
    size: command.size,
    predefined: phrases.map((p) => p.text),
    customPhrases: command.customPhrases,
    rewards: command.rewards,
  });

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateSessionCode();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        code,
        size: command.size,
        gm_id: user.id,
      })
      .select("id, code")
      .single();

    if (sessionError) {
      if (sessionError.code === "23505") {
        continue;
      }
      throw sessionError;
    }

    const cellRows = generatedCells.map((cell) => ({
      session_id: session.id,
      position: cell.position,
      phrase: cell.phrase,
      reward_id: cell.rewardId,
    }));

    const { error: cellsError } = await supabase.from("board_cells").insert(cellRows);
    if (cellsError) {
      throw cellsError;
    }

    return { id: session.id, code: session.code };
  }

  throw new SessionServiceError("CODE_COLLISION");
}

export async function listSessionsForGm(supabase: AppSupabaseClient, gmId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("gm_id", gmId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getSessionWithCells(
  supabase: AppSupabaseClient,
  id: string,
  gmId: string,
): Promise<SessionWithCells | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select(
      `
      *,
      cells:board_cells (
        *,
        reward:rewards ( slug, label )
      )
    `,
    )
    .eq("id", id)
    .eq("gm_id", gmId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const cells = [...data.cells]
    .sort((a, b) => a.position - b.position)
    .map((cell) => ({
      ...cell,
      claimedByColor: null as number | null,
    }));

  return {
    id: data.id,
    gm_id: data.gm_id,
    code: data.code,
    size: data.size,
    status: data.status,
    created_at: data.created_at,
    cells,
    players: [],
  };
}

export async function getActiveBoardByCode(supabase: AppSupabaseClient, code: string): Promise<PlayerBoard | null> {
  const { data, error } = await supabase.rpc("get_active_board_by_code", { p_code: code });

  if (error) throw error;
  if (data.length === 0) return null;

  const head = data[0];

  return {
    code: head.code,
    size: head.size,
    cells: data.map((row) => {
      const reward =
        row.reward_slug === null || row.reward_label === null
          ? null
          : { slug: row.reward_slug, label: row.reward_label };
      return {
        position: row.position,
        phrase: row.phrase,
        hasReward: reward !== null,
        // Until Phase 3 replaces the board RPC, labels still come through here.
        reward,
        claimedByColor: null,
      };
    }),
  };
}
