import { describe, expect, it } from "vitest";
import { aggregateRewardCountsFromCells, isBoardSize, rewardRulesFromPoolRows } from "@/lib/services/session-prefill";

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

describe("rewardRulesFromPoolRows", () => {
  const lineA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const lineB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const thresh = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("splits pool rows by kind and keeps thresholdCount when threshold ids exist", () => {
    const actual = rewardRulesFromPoolRows(
      [
        { kind: "threshold", reward_id: thresh },
        { kind: "line", reward_id: lineB },
        { kind: "line", reward_id: lineA },
      ],
      3,
    );
    expect(actual).toEqual({
      lineRewardIds: [lineA, lineB],
      thresholdRewardIds: [thresh],
      thresholdCount: 3,
    });
  });

  it("normalises thresholdCount to null when no threshold pool rows", () => {
    const actual = rewardRulesFromPoolRows([{ kind: "line", reward_id: lineA }], 5);
    expect(actual).toEqual({
      lineRewardIds: [lineA],
      thresholdRewardIds: [],
      thresholdCount: null,
    });
  });

  it("returns empty rules for empty pool", () => {
    expect(rewardRulesFromPoolRows([], null)).toEqual({
      lineRewardIds: [],
      thresholdRewardIds: [],
      thresholdCount: null,
    });
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
