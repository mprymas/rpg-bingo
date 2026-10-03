import type { Database } from "@/db/database.types";

export type Phrase = Database["public"]["Tables"]["phrases"]["Row"];
export type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type BoardCell = Database["public"]["Tables"]["board_cells"]["Row"];

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

export type SessionWithCells = Session & {
  cells: (BoardCell & {
    reward: Pick<Reward, "slug" | "label"> | null;
  })[];
};

export interface PlayerBoard {
  code: string;
  size: number;
  cells: {
    position: number;
    phrase: string;
    reward: Pick<Reward, "slug" | "label"> | null;
  }[];
}
