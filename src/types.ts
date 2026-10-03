import type { Database } from "@/db/database.types";

export type Phrase = Database["public"]["Tables"]["phrases"]["Row"];
export type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type BoardCell = Database["public"]["Tables"]["board_cells"]["Row"];
export type SessionPlayer = Database["public"]["Tables"]["session_players"]["Row"];

export type SessionStatus = "active" | "closed";
export type BoardSize = 3 | 4 | 5;

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

export interface CreateSessionCommand {
  size: BoardSize;
  customPhrases: CustomPhraseInput[];
  rewards: RewardCountInput[];
}

export interface CreateSessionResponse {
  id: string;
  code: string;
}

export interface ApiErrorResponse {
  error: string;
}

export interface GeneratedCell {
  position: number;
  phrase: string;
  rewardId: string | null;
}

/** GM roster entry: nick shown in the player's assigned color. */
export type SessionPlayerRosterEntry = Pick<SessionPlayer, "id" | "nick" | "color" | "created_at">;

/** Player-facing roster — no row ids (claim auth uses a secret claim_token in the cookie). */
export type PlayerRosterEntry = Pick<SessionPlayer, "nick" | "color" | "created_at">;

export type SessionWithCells = Session & {
  cells: (BoardCell & {
    reward: Pick<Reward, "slug" | "label"> | null;
    /** Claimer color 1–8 when occupied; null when free. */
    claimedByColor: number | null;
  })[];
  players: SessionPlayerRosterEntry[];
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
  cells: PlayerBoardCell[];
  players: PlayerRosterEntry[];
}

export interface ClaimOccupant {
  nick: string;
  color: number;
}

export interface ClaimSuccessResponse {
  cell: PlayerBoardCell;
}

export interface ClaimConflictResponse {
  error: "conflict";
  occupant: ClaimOccupant;
  cell: PlayerBoardCell;
}
