import type { Database } from "@/db/database.types";

export type Phrase = Database["public"]["Tables"]["phrases"]["Row"];
export type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type BoardCell = Database["public"]["Tables"]["board_cells"]["Row"];
export type SessionPlayer = Database["public"]["Tables"]["session_players"]["Row"];

export type SessionStatus = "active" | "closed";
export type BoardSize = 3 | 4 | 5;
export type LineAxis = "row" | "column";
export type RewardRef = Pick<Reward, "slug" | "label">;

export const BOARD_SIZES = [3, 4, 5] as const;
export const SESSION_CODE_LENGTH = 6;

export interface CustomPhraseInput {
  text: string;
  guaranteed: boolean;
}

export interface RewardCountInput {
  rewardId: string;
  count: number;
}

export interface EarnedLineReward {
  axis: LineAxis;
  index: number;
  reward: RewardRef;
}

/** Edge slot for a pre-drawn row/column reward on the board frame. */
export interface BoardLineSlot {
  axis: LineAxis;
  index: number;
  /** Null for players while the line is incomplete (mystery). GM always has a label. */
  reward: RewardRef | null;
  /** Completer colour when the line is complete; null otherwise. */
  claimedByColor: number | null;
}

export interface PlayerRewardProgress {
  claimedCount: number;
  thresholdCount: number | null;
  thresholdReward: RewardRef | null;
  lines: EarnedLineReward[];
  /** Per-field rewards from cells this player currently holds. */
  fieldRewards: RewardRef[];
}

export interface SessionRewardRules {
  thresholdCount: number | null;
  thresholdRewardIds: string[];
  lineRewardIds: string[];
}

export interface CreateSessionCommand {
  size: BoardSize;
  customPhrases: CustomPhraseInput[];
  rewards: RewardCountInput[];
  lineRewardIds: string[];
  thresholdRewardIds: string[];
  thresholdCount: number | null;
  /** When set, create closes this owned active session after the new board succeeds. */
  replaceSessionId?: string;
}

export type CloseErrorReason = "SESSION_NOT_FOUND" | "SESSION_NOT_ACTIVE" | "REPLACEMENT_NOT_FOUND" | "UNKNOWN";

export interface CreateSessionResponse {
  id: string;
  code: string;
  /** Present when the new session was created but closing the source failed. */
  closeError?: string;
  closeErrorReason?: CloseErrorReason;
}

export interface ApiErrorResponse {
  error: string;
}

export interface GeneratedCell {
  position: number;
  phrase: string;
  rewardId: string | null;
}

export interface GeneratedLine {
  axis: LineAxis;
  index: number;
  rewardId: string;
}

/** GM roster entry: nick shown in the player's assigned color. */
export type SessionPlayerRosterEntry = Pick<SessionPlayer, "id" | "nick" | "color" | "created_at"> & {
  earned: {
    claimedCount: number;
    /** Threshold reward once the player holds ≥ N fields; null before then. */
    thresholdReward: RewardRef | null;
    /** Pre-drawn at join; shown to GM even before the threshold is met. */
    thresholdRewardAssigned: RewardRef | null;
    lines: EarnedLineReward[];
    /** Per-field rewards on cells this player currently holds. */
    fieldRewards: RewardRef[];
  };
};

/** Player-facing roster — no row ids (claim auth uses a secret claim_token in the cookie). */
export type PlayerRosterEntry = Pick<SessionPlayer, "nick" | "color" | "created_at"> & {
  claimedCount: number;
  /** Threshold reward once this player holds ≥ N fields; null until then (mystery tile). */
  thresholdReward: RewardRef | null;
};

export type SessionWithCells = Session & {
  cells: (BoardCell & {
    reward: Pick<Reward, "slug" | "label"> | null;
    /** Claimer color 1–8 when occupied; null when free. */
    claimedByColor: number | null;
  })[];
  players: SessionPlayerRosterEntry[];
  rewardRules: SessionRewardRules;
  /** Pre-drawn row/column edge slots (empty when line rules are off). */
  lineRewards: BoardLineSlot[];
};

/**
 * Player-facing board cell. Unclaimed rewarded cells expose `hasReward` only;
 * `reward` is set after the cell is claimed (public reveal).
 */
export interface PlayerBoardCell {
  position: number;
  phrase: string;
  hasReward: boolean;
  reward: Pick<Reward, "slug" | "label"> | null;
  claimedByColor: number | null;
}

export interface PlayerBoard {
  code: string;
  size: number;
  status: SessionStatus;
  /** Present when this closed session was replaced; null for active or closed-without-successor. */
  successorCode: string | null;
  cells: PlayerBoardCell[];
  players: PlayerRosterEntry[];
  /** Session threshold N when field-count rewards are configured; null otherwise. */
  thresholdCount: number | null;
  /** Null when no player identity or the session has no threshold/line/field rewards. */
  progress: PlayerRewardProgress | null;
  /** Row/column edge slots; empty without identity or when line rules are off. */
  lineSlots: BoardLineSlot[];
}

export interface ClaimOccupant {
  nick: string;
  color: number;
}

export interface ClaimSuccessResponse {
  cell: PlayerBoardCell;
  progress: PlayerRewardProgress | null;
  lineSlots: BoardLineSlot[];
}

export interface ClaimConflictResponse {
  error: "conflict";
  occupant: ClaimOccupant;
  cell: PlayerBoardCell;
}

export interface UndoClaimSuccessResponse {
  cell: SessionWithCells["cells"][number];
}

export interface CloseSessionSuccessResponse {
  ok: true;
}

export interface DeleteSessionSuccessResponse {
  ok: true;
}
