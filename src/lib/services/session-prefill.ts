import type { BoardSize, RewardCountInput, SessionRewardRules } from "@/types";
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

function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Build SessionRewardRules from session_reward_pool rows + sessions.threshold_count. */
export function rewardRulesFromPoolRows(
  rows: { kind: string; reward_id: string }[],
  thresholdCount: number | null,
): SessionRewardRules {
  const lineRewardIds: string[] = [];
  const thresholdRewardIds: string[] = [];
  for (const row of rows) {
    if (row.kind === "line") lineRewardIds.push(row.reward_id);
    else if (row.kind === "threshold") thresholdRewardIds.push(row.reward_id);
  }
  return {
    lineRewardIds: sortIds(lineRewardIds),
    thresholdRewardIds: sortIds(thresholdRewardIds),
    thresholdCount: thresholdRewardIds.length === 0 ? null : thresholdCount,
  };
}

export function isBoardSize(value: number): value is BoardSize {
  return (BOARD_SIZES as readonly number[]).includes(value);
}
