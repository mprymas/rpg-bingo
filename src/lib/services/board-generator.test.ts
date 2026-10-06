import { describe, expect, it } from "vitest";
import { generateBoard } from "@/lib/services/board-generator";

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
