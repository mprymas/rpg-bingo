import type { BoardSize, RewardCountInput } from "@/types";
import { BOARD_SIZES } from "@/types";

/** Aggregate board_cells reward_id → count for create-form prefill. */
export function aggregateRewardCountsFromCells(cells: { reward_id: string | null }[]): RewardCountInput[] {
  const counts = new Map<string, number>();
  for (const cell of cells) {
    if (!cell.reward_id) continue;
    counts.set(cell.reward_id, (counts.get(cell.reward_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([rewardId, count]) => ({ rewardId, count }))
    .sort((a, b) => (a.rewardId < b.rewardId ? -1 : a.rewardId > b.rewardId ? 1 : 0));
}

export function isBoardSize(value: number): value is BoardSize {
  return (BOARD_SIZES as readonly number[]).includes(value);
}
