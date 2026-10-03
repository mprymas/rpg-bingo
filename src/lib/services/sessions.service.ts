import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { generateBoard } from "@/lib/services/board-generator";
import { generateSessionCode } from "@/lib/services/session-code";
import type {
  ClaimOccupant,
  CreateSessionCommand,
  CreateSessionResponse,
  PlayerBoard,
  PlayerBoardCell,
  PlayerRosterEntry,
  Session,
  SessionPlayerRosterEntry,
  SessionWithCells,
} from "@/types";

type AppSupabaseClient = SupabaseClient<Database>;

/** Supabase generated types omit null; runtime can still return null on success. */
function rpcRows<T>(data: T[] | null): T[] {
  return data ?? [];
}

export type SessionServiceErrorCode = "UNKNOWN_REWARD" | "CODE_COLLISION";

export class SessionServiceError extends Error {
  readonly code: SessionServiceErrorCode;

  constructor(code: SessionServiceErrorCode) {
    super(code);
    this.name = "SessionServiceError";
    this.code = code;
  }
}

export type ClaimBoardCellErrorCode = "SESSION_NOT_FOUND" | "PLAYER_NOT_FOUND" | "INVALID_POSITION" | "CELL_NOT_FOUND";

export class ClaimBoardCellError extends Error {
  readonly code: ClaimBoardCellErrorCode;

  constructor(code: ClaimBoardCellErrorCode) {
    super(code);
    this.name = "ClaimBoardCellError";
    this.code = code;
  }
}

export type ClaimBoardCellResult =
  { status: "claimed"; cell: PlayerBoardCell } | { status: "conflict"; occupant: ClaimOccupant; cell: PlayerBoardCell };

function mapPlayerBoardCell(row: {
  position: number;
  phrase: string;
  has_reward: boolean;
  reward_slug: string | null;
  reward_label: string | null;
  claimed_by_color: number | null;
}): PlayerBoardCell {
  const reward =
    row.reward_slug === null || row.reward_label === null ? null : { slug: row.reward_slug, label: row.reward_label };
  return {
    position: row.position,
    phrase: row.phrase,
    hasReward: row.has_reward,
    reward,
    claimedByColor: row.claimed_by_color,
  };
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
      ),
      players:session_players ( id, nick, color, created_at )
    `,
    )
    .eq("id", id)
    .eq("gm_id", gmId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const players: SessionPlayerRosterEntry[] = [...data.players].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
  );
  const colorByPlayerId = new Map(players.map((player) => [player.id, player.color]));

  const cells = [...data.cells]
    .sort((a, b) => a.position - b.position)
    .map((cell) => ({
      ...cell,
      claimedByColor: cell.claimed_by_player_id ? (colorByPlayerId.get(cell.claimed_by_player_id) ?? null) : null,
    }));

  return {
    id: data.id,
    gm_id: data.gm_id,
    code: data.code,
    size: data.size,
    status: data.status,
    created_at: data.created_at,
    cells,
    players,
  };
}

export async function getActiveBoardByCode(supabase: AppSupabaseClient, code: string): Promise<PlayerBoard | null> {
  const [{ data, error }, { data: playersData, error: playersError }] = await Promise.all([
    supabase.rpc("get_active_board_by_code", { p_code: code }),
    supabase.rpc("get_session_players_by_code", { p_code: code }),
  ]);

  if (error) throw error;
  if (playersError) throw playersError;

  const boardRows = rpcRows(data);
  const playerRows = rpcRows(playersData);
  if (boardRows.length === 0) return null;

  const head = boardRows[0];
  const players: PlayerRosterEntry[] = playerRows.map((player) => ({
    nick: player.nick,
    color: player.color,
    created_at: player.created_at,
  }));

  return {
    code: head.code,
    size: head.size,
    cells: boardRows.map((row) => mapPlayerBoardCell(row)),
    players,
  };
}

export interface JoinedSessionPlayer {
  playerId: string;
  claimToken: string;
  color: number;
  nick: string;
}

export type JoinSessionPlayerErrorCode = "SESSION_NOT_FOUND" | "SESSION_FULL" | "INVALID_NICK";

export class JoinSessionPlayerError extends Error {
  readonly code: JoinSessionPlayerErrorCode;

  constructor(code: JoinSessionPlayerErrorCode) {
    super(code);
    this.name = "JoinSessionPlayerError";
    this.code = code;
  }
}

function joinErrorFromMessage(message: string): JoinSessionPlayerError | null {
  if (message.includes("session_not_found")) return new JoinSessionPlayerError("SESSION_NOT_FOUND");
  if (message.includes("session_full")) return new JoinSessionPlayerError("SESSION_FULL");
  if (message.includes("invalid_nick")) return new JoinSessionPlayerError("INVALID_NICK");
  return null;
}

export async function joinSessionPlayer(
  supabase: AppSupabaseClient,
  input: { code: string; nick: string; claimToken?: string | null },
): Promise<JoinedSessionPlayer> {
  const args: Database["public"]["Functions"]["join_session_player"]["Args"] = {
    p_code: input.code,
    p_nick: input.nick,
  };
  if (input.claimToken) {
    args.p_claim_token = input.claimToken;
  }

  const { data, error } = await supabase.rpc("join_session_player", args);

  if (error) {
    const mapped = joinErrorFromMessage(error.message);
    if (mapped) throw mapped;
    throw error;
  }

  const rows = rpcRows(data);
  if (rows.length === 0) {
    throw new Error("join_session_player returned no row");
  }

  const row = rows[0];

  return {
    playerId: row.id,
    claimToken: row.claim_token,
    color: row.color,
    nick: row.nick,
  };
}

function claimErrorFromMessage(message: string): ClaimBoardCellError | null {
  if (message.includes("session_not_found")) return new ClaimBoardCellError("SESSION_NOT_FOUND");
  if (message.includes("player_not_found")) return new ClaimBoardCellError("PLAYER_NOT_FOUND");
  if (message.includes("invalid_position")) return new ClaimBoardCellError("INVALID_POSITION");
  if (message.includes("cell_not_found")) return new ClaimBoardCellError("CELL_NOT_FOUND");
  return null;
}

export async function claimBoardCell(
  supabase: AppSupabaseClient,
  input: { code: string; claimToken: string; position: number },
): Promise<ClaimBoardCellResult> {
  const { data, error } = await supabase.rpc("claim_board_cell", {
    p_code: input.code,
    p_claim_token: input.claimToken,
    p_position: input.position,
  });

  if (error) {
    const mapped = claimErrorFromMessage(error.message);
    if (mapped) throw mapped;
    throw error;
  }

  const rows = rpcRows(data);
  if (rows.length === 0) {
    throw new Error("claim_board_cell returned no row");
  }

  const row = rows[0];
  const cell = mapPlayerBoardCell(row);

  if (row.status === "conflict") {
    if (row.occupant_nick === null || row.occupant_color === null) {
      throw new Error("claim_board_cell conflict missing occupant");
    }
    return {
      status: "conflict",
      occupant: { nick: row.occupant_nick, color: row.occupant_color },
      cell,
    };
  }

  if (row.status !== "claimed") {
    throw new Error(`claim_board_cell unknown status: ${row.status}`);
  }

  return { status: "claimed", cell };
}

export type UndoBoardCellErrorCode = "SESSION_NOT_FOUND" | "INVALID_POSITION" | "CELL_NOT_FOUND";

export class UndoBoardCellError extends Error {
  readonly code: UndoBoardCellErrorCode;

  constructor(code: UndoBoardCellErrorCode) {
    super(code);
    this.name = "UndoBoardCellError";
    this.code = code;
  }
}

export interface UndoBoardCellResult {
  cell: SessionWithCells["cells"][number];
}

function undoErrorFromMessage(message: string): UndoBoardCellError | null {
  if (message.includes("session_not_found")) return new UndoBoardCellError("SESSION_NOT_FOUND");
  if (message.includes("invalid_position")) return new UndoBoardCellError("INVALID_POSITION");
  if (message.includes("cell_not_found")) return new UndoBoardCellError("CELL_NOT_FOUND");
  return null;
}

export async function undoBoardCell(
  supabase: AppSupabaseClient,
  input: { sessionId: string; position: number },
): Promise<UndoBoardCellResult> {
  const { error } = await supabase.rpc("undo_board_cell", {
    p_session_id: input.sessionId,
    p_position: input.position,
  });

  if (error) {
    const mapped = undoErrorFromMessage(error.message);
    if (mapped) throw mapped;
    throw error;
  }

  // RPC omits board_cells identity fields; re-select under GM RLS for SessionWithCells cell DTO.
  const { data: cellRow, error: cellError } = await supabase
    .from("board_cells")
    .select(
      `
      *,
      reward:rewards ( slug, label )
    `,
    )
    .eq("session_id", input.sessionId)
    .eq("position", input.position)
    .maybeSingle();

  if (cellError) throw cellError;
  if (!cellRow) {
    throw new UndoBoardCellError("CELL_NOT_FOUND");
  }

  return {
    cell: {
      ...cellRow,
      claimedByColor: null,
    },
  };
}
