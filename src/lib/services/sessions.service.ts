import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/db/database.types";
import { drawLineRewards, generateBoard } from "@/lib/services/board-generator";
import { buildLineSlots } from "@/lib/services/line-slots";
import { deriveRewardProgress } from "@/lib/services/reward-progress";
import { generateSessionCode } from "@/lib/services/session-code";
import type {
  BoardLineSlot,
  ClaimOccupant,
  CloseSessionSuccessResponse,
  DeleteSessionSuccessResponse,
  CreateSessionCommand,
  CreateSessionResponse,
  LineAxis,
  PlayerBoard,
  PlayerBoardCell,
  PlayerRewardProgress,
  PlayerRosterEntry,
  RewardRef,
  Session,
  SessionPlayerRosterEntry,
  SessionStatus,
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
  for (const rewardId of command.lineRewardIds) {
    if (!rewardIds.has(rewardId)) {
      throw new SessionServiceError("UNKNOWN_REWARD");
    }
  }
  for (const rewardId of command.thresholdRewardIds) {
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
  const generatedLines = drawLineRewards({
    size: command.size,
    lineRewardIds: command.lineRewardIds,
  });

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateSessionCode();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        code,
        size: command.size,
        gm_id: user.id,
        threshold_count: command.thresholdCount,
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

    const poolRows = [
      ...command.lineRewardIds.map((rewardId) => ({
        session_id: session.id,
        kind: "line" as const,
        reward_id: rewardId,
      })),
      ...command.thresholdRewardIds.map((rewardId) => ({
        session_id: session.id,
        kind: "threshold" as const,
        reward_id: rewardId,
      })),
    ];
    if (poolRows.length > 0) {
      const { error: poolError } = await supabase.from("session_reward_pool").insert(poolRows);
      if (poolError) {
        throw poolError;
      }
    }

    if (generatedLines.length > 0) {
      const lineRows = generatedLines.map((line) => ({
        session_id: session.id,
        axis: line.axis,
        index: line.index,
        reward_id: line.rewardId,
      }));
      const { error: linesError } = await supabase.from("board_lines").insert(lineRows);
      if (linesError) {
        throw linesError;
      }
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

export async function getSessionCodeForGm(
  supabase: AppSupabaseClient,
  id: string,
  gmId: string,
): Promise<string | null> {
  const { data, error } = await supabase.from("sessions").select("code").eq("id", id).eq("gm_id", gmId).maybeSingle();

  if (error) throw error;
  return data?.code ?? null;
}

function isLineAxis(value: string): value is LineAxis {
  return value === "row" || value === "column";
}

function isRewardRef(value: unknown): value is RewardRef {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.slug === "string" && typeof record.label === "string";
}

interface PlayerRewardInputs {
  size: number;
  threshold_count: number | null;
  has_line_rules: boolean;
  threshold_reward: RewardRef | null;
  cells: { position: number; claimed_at: string; is_mine: boolean }[];
  lines: { axis: LineAxis; index: number; slug: string; label: string }[];
  field_rewards: RewardRef[];
  line_slots: BoardLineSlot[];
}

export interface PlayerRewardSnapshot {
  progress: PlayerRewardProgress | null;
  lineSlots: BoardLineSlot[];
}

function parsePlayerRewardInputs(data: Json): PlayerRewardInputs | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.size !== "number" || !Number.isInteger(record.size)) return null;

  const thresholdCount =
    record.threshold_count === null || record.threshold_count === undefined
      ? null
      : typeof record.threshold_count === "number" && Number.isInteger(record.threshold_count)
        ? record.threshold_count
        : null;
  if (record.threshold_count != null && thresholdCount === null) return null;

  let thresholdReward: RewardRef | null = null;
  if (record.threshold_reward != null) {
    if (!isRewardRef(record.threshold_reward)) return null;
    thresholdReward = { slug: record.threshold_reward.slug, label: record.threshold_reward.label };
  }

  if (typeof record.has_line_rules !== "boolean") return null;
  if (
    !Array.isArray(record.cells) ||
    !Array.isArray(record.lines) ||
    !Array.isArray(record.field_rewards) ||
    !Array.isArray(record.line_slots)
  ) {
    return null;
  }

  const cells: PlayerRewardInputs["cells"] = [];
  for (const cell of record.cells) {
    if (!cell || typeof cell !== "object") return null;
    const c = cell as Record<string, unknown>;
    if (typeof c.position !== "number" || typeof c.claimed_at !== "string" || typeof c.is_mine !== "boolean") {
      return null;
    }
    cells.push({ position: c.position, claimed_at: c.claimed_at, is_mine: c.is_mine });
  }

  const lines: PlayerRewardInputs["lines"] = [];
  for (const line of record.lines) {
    if (!line || typeof line !== "object") return null;
    const l = line as Record<string, unknown>;
    if (
      typeof l.axis !== "string" ||
      !isLineAxis(l.axis) ||
      typeof l.index !== "number" ||
      typeof l.slug !== "string" ||
      typeof l.label !== "string"
    ) {
      return null;
    }
    lines.push({ axis: l.axis, index: l.index, slug: l.slug, label: l.label });
  }

  const fieldRewards: RewardRef[] = [];
  for (const reward of record.field_rewards) {
    if (!isRewardRef(reward)) return null;
    fieldRewards.push({ slug: reward.slug, label: reward.label });
  }

  const lineSlots: BoardLineSlot[] = [];
  for (const slot of record.line_slots) {
    if (!slot || typeof slot !== "object") return null;
    const s = slot as Record<string, unknown>;
    if (typeof s.axis !== "string" || !isLineAxis(s.axis) || typeof s.index !== "number") return null;
    const color =
      s.claimed_by_color === null || s.claimed_by_color === undefined
        ? null
        : typeof s.claimed_by_color === "number"
          ? s.claimed_by_color
          : null;
    if (s.claimed_by_color != null && color === null) return null;

    let reward: RewardRef | null = null;
    if (s.slug != null || s.label != null) {
      if (typeof s.slug !== "string" || typeof s.label !== "string") return null;
      reward = { slug: s.slug, label: s.label };
    }
    lineSlots.push({ axis: s.axis, index: s.index, reward, claimedByColor: color });
  }

  return {
    size: record.size,
    threshold_count: thresholdCount,
    has_line_rules: record.has_line_rules,
    threshold_reward: thresholdReward,
    cells,
    lines,
    field_rewards: fieldRewards,
    line_slots: lineSlots,
  };
}

/** Derived progress + line edge slots for one player seat. */
export async function getPlayerRewardSnapshot(
  supabase: AppSupabaseClient,
  code: string,
  claimToken: string,
): Promise<PlayerRewardSnapshot> {
  const { data, error } = await supabase.rpc("get_player_reward_inputs", {
    p_code: code,
    p_claim_token: claimToken,
  });

  if (error) throw error;
  if (data == null) return { progress: null, lineSlots: [] };

  const inputs = parsePlayerRewardInputs(data);
  if (!inputs) {
    throw new Error("get_player_reward_inputs returned unexpected shape");
  }

  const lineSlots = inputs.line_slots;
  const hasRules = inputs.threshold_count != null || inputs.has_line_rules || inputs.field_rewards.length > 0;
  if (!hasRules) return { progress: null, lineSlots };

  const progressByKey = deriveRewardProgress({
    size: inputs.size,
    cells: inputs.cells.map((cell) => ({
      position: cell.position,
      claimedBy: cell.is_mine ? "me" : "other",
      claimedAt: cell.claimed_at,
    })),
    lines: inputs.lines.map((line) => ({
      axis: line.axis,
      index: line.index,
      reward: { slug: line.slug, label: line.label },
    })),
    thresholdCount: inputs.threshold_count,
    thresholdRewardByPlayer: new Map([["me", inputs.threshold_reward]]),
  });

  const base = progressByKey.get("me") ?? {
    claimedCount: 0,
    thresholdCount: inputs.threshold_count,
    thresholdReward: null,
    lines: [],
    fieldRewards: [],
  };

  return { progress: { ...base, fieldRewards: inputs.field_rewards }, lineSlots };
}

/** @deprecated Prefer getPlayerRewardSnapshot — kept for call-site migration. */
export async function getPlayerRewardProgress(
  supabase: AppSupabaseClient,
  code: string,
  claimToken: string,
): Promise<PlayerRewardProgress | null> {
  const snapshot = await getPlayerRewardSnapshot(supabase, code, claimToken);
  return snapshot.progress;
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
      players:session_players (
        id,
        nick,
        color,
        created_at,
        threshold_reward_id,
        threshold_reward:rewards ( slug, label )
      ),
      pool:session_reward_pool ( kind, reward_id ),
      lines:board_lines (
        axis,
        index,
        reward:rewards ( slug, label )
      )
    `,
    )
    .eq("id", id)
    .eq("gm_id", gmId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const pool = data.pool;
  const thresholdRewardIds = pool.filter((row) => row.kind === "threshold").map((row) => row.reward_id);
  const lineRewardIds = pool.filter((row) => row.kind === "line").map((row) => row.reward_id);

  const boardLines = data.lines
    .filter((line) => isLineAxis(line.axis) && isRewardRef(line.reward))
    .map((line) => ({
      axis: line.axis as LineAxis,
      index: line.index,
      reward: { slug: line.reward.slug, label: line.reward.label },
    }));

  const thresholdRewardByPlayer = new Map<string, RewardRef | null>();
  for (const player of data.players) {
    const drawn =
      player.threshold_reward && isRewardRef(player.threshold_reward)
        ? { slug: player.threshold_reward.slug, label: player.threshold_reward.label }
        : null;
    thresholdRewardByPlayer.set(player.id, drawn);
  }

  const progressByPlayer = deriveRewardProgress({
    size: data.size,
    cells: data.cells.map((cell) => ({
      position: cell.position,
      claimedBy: cell.claimed_by_player_id,
      claimedAt: cell.claimed_at,
    })),
    lines: boardLines,
    thresholdCount: data.threshold_count,
    thresholdRewardByPlayer,
  });

  const fieldRewardsByPlayer = new Map<string, RewardRef[]>();
  for (const cell of data.cells) {
    if (!cell.claimed_by_player_id || !cell.reward || !isRewardRef(cell.reward)) continue;
    const list = fieldRewardsByPlayer.get(cell.claimed_by_player_id) ?? [];
    list.push({ slug: cell.reward.slug, label: cell.reward.label });
    fieldRewardsByPlayer.set(cell.claimed_by_player_id, list);
  }

  const players: SessionPlayerRosterEntry[] = [...data.players]
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .map((player) => {
      const earned = progressByPlayer.get(player.id) ?? {
        claimedCount: 0,
        thresholdCount: data.threshold_count,
        thresholdReward: null,
        lines: [],
        fieldRewards: [],
      };
      const assigned = thresholdRewardByPlayer.get(player.id) ?? null;
      return {
        id: player.id,
        nick: player.nick,
        color: player.color,
        created_at: player.created_at,
        earned: {
          claimedCount: earned.claimedCount,
          thresholdReward: earned.thresholdReward,
          thresholdRewardAssigned: assigned,
          lines: earned.lines,
          fieldRewards: fieldRewardsByPlayer.get(player.id) ?? [],
        },
      };
    });
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
    replaced_by_session_id: data.replaced_by_session_id,
    created_at: data.created_at,
    threshold_count: data.threshold_count,
    cells,
    players,
    rewardRules: {
      thresholdCount: data.threshold_count,
      thresholdRewardIds,
      lineRewardIds,
    },
    lineRewards: buildLineSlots({
      size: data.size,
      cells: cells.map((cell) => ({
        position: cell.position,
        claimedByColor: cell.claimedByColor,
        claimedAt: cell.claimed_at,
      })),
      lines: boardLines,
      revealWhenIncomplete: true,
    }),
  };
}

function mapSessionStatus(value: string): SessionStatus | null {
  if (value === "active" || value === "closed") return value;
  return null;
}

/** Active or closed player board by code; unknown / non-matching codes return null. */
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
  const status = mapSessionStatus(head.status);
  if (!status) return null;

  const players: PlayerRosterEntry[] = playerRows.map((player) => {
    const slug = player.threshold_reward_slug;
    const label = player.threshold_reward_label;
    const thresholdReward = typeof slug === "string" && typeof label === "string" ? { slug, label } : null;
    return {
      nick: player.nick,
      color: player.color,
      created_at: player.created_at,
      claimedCount: player.claimed_count,
      thresholdReward,
    };
  });

  const thresholdCount =
    playerRows.length > 0 && typeof playerRows[0].threshold_count === "number" ? playerRows[0].threshold_count : null;

  return {
    code: head.code,
    size: head.size,
    status,
    successorCode: head.successor_code,
    cells: boardRows.map((row) => mapPlayerBoardCell(row)),
    players,
    thresholdCount,
    progress: null,
    lineSlots: [],
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

export type CloseSessionAsReplacedErrorCode = "SESSION_NOT_FOUND" | "SESSION_NOT_ACTIVE" | "REPLACEMENT_NOT_FOUND";

export class CloseSessionAsReplacedError extends Error {
  readonly code: CloseSessionAsReplacedErrorCode;

  constructor(code: CloseSessionAsReplacedErrorCode) {
    super(code);
    this.name = "CloseSessionAsReplacedError";
    this.code = code;
  }
}

/** Pure mapper from Postgres RAISE messages — unit-testable without a live DB. */
export function closeSessionAsReplacedErrorFromMessage(message: string): CloseSessionAsReplacedError | null {
  if (message.includes("session_not_found")) return new CloseSessionAsReplacedError("SESSION_NOT_FOUND");
  if (message.includes("session_not_active")) return new CloseSessionAsReplacedError("SESSION_NOT_ACTIVE");
  if (message.includes("replacement_not_found")) return new CloseSessionAsReplacedError("REPLACEMENT_NOT_FOUND");
  return null;
}

export async function closeSessionAsReplaced(
  supabase: AppSupabaseClient,
  input: { sessionId: string; replacedBySessionId: string },
): Promise<CloseSessionSuccessResponse> {
  const { error } = await supabase.rpc("close_session_as_replaced", {
    p_session_id: input.sessionId,
    p_replaced_by: input.replacedBySessionId,
  });

  if (error) {
    const mapped = closeSessionAsReplacedErrorFromMessage(error.message);
    if (mapped) throw mapped;
    throw error;
  }

  return { ok: true };
}

export type DeleteSessionErrorCode = "SESSION_NOT_FOUND";

export class DeleteSessionError extends Error {
  readonly code: DeleteSessionErrorCode;

  constructor(code: DeleteSessionErrorCode) {
    super(code);
    this.name = "DeleteSessionError";
    this.code = code;
  }
}

/** Pure mapper from Postgres RAISE messages — unit-testable without a live DB. */
export function deleteSessionErrorFromMessage(message: string): DeleteSessionError | null {
  if (message.includes("session_not_found")) return new DeleteSessionError("SESSION_NOT_FOUND");
  return null;
}

export async function deleteSession(
  supabase: AppSupabaseClient,
  input: { sessionId: string },
): Promise<DeleteSessionSuccessResponse> {
  const { error } = await supabase.rpc("delete_session", {
    p_session_id: input.sessionId,
  });

  if (error) {
    const mapped = deleteSessionErrorFromMessage(error.message);
    if (mapped) throw mapped;
    throw error;
  }

  return { ok: true };
}

export async function undoBoardCell(
  supabase: AppSupabaseClient,
  input: { sessionId: string; position: number },
): Promise<UndoBoardCellResult> {
  const { data, error } = await supabase.rpc("undo_board_cell", {
    p_session_id: input.sessionId,
    p_position: input.position,
  });

  if (error) {
    const mapped = undoErrorFromMessage(error.message);
    if (mapped) throw mapped;
    throw error;
  }

  const rows = rpcRows(data);
  if (rows.length === 0) {
    throw new UndoBoardCellError("CELL_NOT_FOUND");
  }
  const rpcRow = rows[0];

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
      // Undo RPC commits a free cell; align DTO with that snapshot (not a later reclaim race).
      claimed_by_player_id: null,
      claimed_at: null,
      claimedByColor: rpcRow.claimed_by_color,
      reward:
        rpcRow.reward_slug != null && rpcRow.reward_label != null
          ? { slug: rpcRow.reward_slug, label: rpcRow.reward_label }
          : null,
    },
  };
}
