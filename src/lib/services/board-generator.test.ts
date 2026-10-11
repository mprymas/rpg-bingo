import { describe, expect, it } from "vitest";
import { drawLineRewards, generateBoard } from "@/lib/services/board-generator";

describe("generateBoard", () => {
  it("returns size² cells with unique positions and phrases for a fixed random", () => {
    const predefined = Array.from({ length: 9 }, (_, i) => `phrase-${i}`);
    const cells = generateBoard({
      size: 3,
      predefined,
      customPhrases: [],
      rewards: [],
      random: () => 0,
    });

    expect(cells).toHaveLength(9);
    expect(cells.map((c) => c.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(cells.map((c) => c.phrase)).size).toBe(9);
    expect(cells.every((c) => c.phrase.trim().length >= 1)).toBe(true);
    expect(cells.every((c) => c.rewardId === null)).toBe(true);
  });
});

describe("drawLineRewards", () => {
  it("returns [] when the line reward list is empty", () => {
    expect(drawLineRewards({ size: 3, lineRewardIds: [], random: () => 0 })).toEqual([]);
  });

  it("returns 2×size entries with ids from the list for a fixed random", () => {
    const ids = ["r1", "r2"];
    const lines = drawLineRewards({ size: 3, lineRewardIds: ids, random: () => 0 });

    expect(lines).toHaveLength(6);
    expect(lines.every((l) => ids.includes(l.rewardId))).toBe(true);
    expect(lines.map((l) => ({ axis: l.axis, index: l.index }))).toEqual([
      { axis: "row", index: 0 },
      { axis: "row", index: 1 },
      { axis: "row", index: 2 },
      { axis: "column", index: 0 },
      { axis: "column", index: 1 },
      { axis: "column", index: 2 },
    ]);
    // random() === 0 → always first id
    expect(lines.every((l) => l.rewardId === "r1")).toBe(true);
  });

  it("is deterministic with a fixed RNG sequence", () => {
    let i = 0;
    const sequence = [0, 0.5, 0.9, 0, 0.5, 0.9];
    const random = () => sequence[i++] ?? 0;
    const a = drawLineRewards({ size: 3, lineRewardIds: ["a", "b"], random });
    i = 0;
    const b = drawLineRewards({
      size: 3,
      lineRewardIds: ["a", "b"],
      random: () => sequence[i++] ?? 0,
    });
    expect(a).toEqual(b);
    expect(a.map((l) => l.rewardId)).toEqual(["a", "b", "b", "a", "b", "b"]);
  });
});
