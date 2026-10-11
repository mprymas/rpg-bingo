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

export interface PlayerRewardProgress {
  claimedCount: number;
  thresholdCount: number | null;
  thresholdReward: RewardRef | null;
  lines: EarnedLineReward[];
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
    thresholdReward: RewardRef | null;
    lines: EarnedLineReward[];
  };
};

/** Player-facing roster — no row ids (claim auth uses a secret claim_token in the cookie). */
export type PlayerRosterEntry = Pick<SessionPlayer, "nick" | "color" | "created_at">;

export type SessionWithCells = Session & {
  cells: (BoardCell & {
    reward: Pick<Reward, "slug" | "label"> | null;
    /** Claimer color 1–8 when occupied; null when free. */
    claimedByColor: number | null;
  })[];
  players: SessionPlayerRosterEntry[];
  rewardRules: SessionRewardRules;
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
  /** Null when no player identity or the session has no threshold/line rules. */
  progress: PlayerRewardProgress | null;
}

export interface ClaimOccupant {
  nick: string;
  color: number;
}

export interface ClaimSuccessResponse {
  cell: PlayerBoardCell;
  progress: PlayerRewardProgress | null;
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
