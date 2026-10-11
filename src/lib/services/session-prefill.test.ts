import { describe, expect, it } from "vitest";
import { aggregateRewardCountsFromCells, isBoardSize } from "@/lib/services/session-prefill";

describe("aggregateRewardCountsFromCells", () => {
  it("counts reward_id occurrences and ignores nulls", () => {
    const rewardA = "11111111-1111-4111-8111-111111111111";
    const rewardB = "22222222-2222-4222-8222-222222222222";
    const actual = aggregateRewardCountsFromCells([
      { reward_id: rewardA },
      { reward_id: null },
      { reward_id: rewardB },
      { reward_id: rewardA },
      { reward_id: rewardA },
    ]);
    expect(actual).toEqual([
      { rewardId: rewardA, count: 3 },
      { rewardId: rewardB, count: 1 },
    ]);
  });

  it("returns empty array when no rewards", () => {
    expect(aggregateRewardCountsFromCells([{ reward_id: null }, { reward_id: null }])).toEqual([]);
  });
});

describe("isBoardSize", () => {
  it("accepts 3, 4, 5 and rejects others", () => {
    expect(isBoardSize(3)).toBe(true);
    expect(isBoardSize(4)).toBe(true);
    expect(isBoardSize(5)).toBe(true);
    expect(isBoardSize(2)).toBe(false);
    expect(isBoardSize(6)).toBe(false);
  });
});
