import { describe, expect, it } from "vitest";
import { deriveRewardProgress } from "@/lib/services/reward-progress";
import type { LineAxis, PlayerRewardProgress, RewardRef } from "@/types";

const rewardA: RewardRef = { slug: "reward-a", label: "Reward A" };
const rewardB: RewardRef = { slug: "reward-b", label: "Reward B" };
const rewardT: RewardRef = { slug: "threshold", label: "Threshold" };

function line(axis: LineAxis, index: number, reward: RewardRef = rewardA) {
  return { axis, index, reward };
}

function cell(position: number, claimedBy: string | null, claimedAt: string | null) {
  return { position, claimedBy, claimedAt };
}

function expectProgress(progress: Map<string, PlayerRewardProgress>, key: string): PlayerRewardProgress {
  const value = progress.get(key);
  expect(value).toBeDefined();
  if (value === undefined) {
    throw new Error(`expected progress for ${key}`);
  }
  return value;
}

/** Fill a row or column; last claim uses `completer` / `completerAt`. */
function fillLine(opts: {
  size: number;
  axis: LineAxis;
  index: number;
  earlier: string;
  completer: string;
  baseAt: string;
  completerAt: string;
}) {
  const { size, axis, index, earlier, completer, baseAt, completerAt } = opts;
  const positions =
    axis === "row"
      ? Array.from({ length: size }, (_, i) => index * size + i)
      : Array.from({ length: size }, (_, i) => index + i * size);
  return positions.map((position, i) => {
    const isLast = i === positions.length - 1;
    return cell(position, isLast ? completer : earlier, isLast ? completerAt : baseAt);
  });
}

describe("deriveRewardProgress", () => {
  it.each([3, 4, 5] as const)("row and column membership for size %s", (size) => {
    const rowIndex = 1;
    const colIndex = 2 % size;
    // Complete only row 1 and column colIndex (overlap cell claimed once).
    const claimed = new Map<number, ReturnType<typeof cell>>();
    for (let c = 0; c < size; c++) {
      claimed.set(rowIndex * size + c, cell(rowIndex * size + c, "p1", "2026-01-01T00:00:00Z"));
    }
    for (let r = 0; r < size; r++) {
      const pos = r * size + colIndex;
      if (!claimed.has(pos)) {
        claimed.set(pos, cell(pos, "p1", "2026-01-01T00:00:01Z"));
      }
    }

    const progress = deriveRewardProgress({
      size,
      cells: [...claimed.values()],
      lines: [line("row", rowIndex, rewardA), line("column", colIndex, rewardB)],
      thresholdCount: null,
      thresholdRewardByPlayer: new Map(),
    });

    expect(expectProgress(progress, "p1").lines).toEqual([
      { axis: "row", index: rowIndex, reward: rewardA },
      { axis: "column", index: colIndex, reward: rewardB },
    ]);
  });

  it("assigns completer as latest claimedAt (A, A, then B → B)", () => {
    const cells = [
      cell(0, "A", "2026-01-01T00:00:00Z"),
      cell(1, "A", "2026-01-01T00:00:01Z"),
      cell(2, "B", "2026-01-01T00:00:02Z"),
    ];
    const progress = deriveRewardProgress({
      size: 3,
      cells,
      lines: [line("row", 0)],
      thresholdCount: null,
      thresholdRewardByPlayer: new Map(),
    });

    expect(expectProgress(progress, "B").lines).toEqual([{ axis: "row", index: 0, reward: rewardA }]);
    expect(expectProgress(progress, "A").lines).toEqual([]);
  });

  it("breaks claimedAt ties with higher position", () => {
    const at = "2026-01-01T00:00:00Z";
    const cells = [cell(0, "A", at), cell(1, "B", at), cell(2, "A", at)];
    const progress = deriveRewardProgress({
      size: 3,
      cells,
      lines: [line("row", 0)],
      thresholdCount: null,
      thresholdRewardByPlayer: new Map(),
    });

    // Highest position among the line is 2 → A
    expect(expectProgress(progress, "A").lines).toHaveLength(1);
    expect(expectProgress(progress, "B").lines).toEqual([]);
  });

  it("one claim completing a row and a column awards two line rewards", () => {
    // 3×3: claim all of row 0 and column 0; last claim at (0,0) completes both.
    const cells = [
      cell(1, "A", "2026-01-01T00:00:00Z"),
      cell(2, "A", "2026-01-01T00:00:01Z"),
      cell(3, "A", "2026-01-01T00:00:02Z"),
      cell(6, "A", "2026-01-01T00:00:03Z"),
      cell(0, "B", "2026-01-01T00:00:04Z"), // completes row 0 and column 0
    ];
    const progress = deriveRewardProgress({
      size: 3,
      cells,
      lines: [line("row", 0, rewardA), line("column", 0, rewardB)],
      thresholdCount: null,
      thresholdRewardByPlayer: new Map(),
    });

    expect(expectProgress(progress, "B").lines).toEqual([
      { axis: "row", index: 0, reward: rewardA },
      { axis: "column", index: 0, reward: rewardB },
    ]);
  });

  it("two completed rows by one player yield two line entries", () => {
    const cells = [
      ...fillLine({
        size: 3,
        axis: "row",
        index: 0,
        earlier: "P",
        completer: "P",
        baseAt: "2026-01-01T00:00:00Z",
        completerAt: "2026-01-01T00:00:01Z",
      }),
      ...fillLine({
        size: 3,
        axis: "row",
        index: 1,
        earlier: "P",
        completer: "P",
        baseAt: "2026-01-01T00:00:02Z",
        completerAt: "2026-01-01T00:00:03Z",
      }),
    ];
    const progress = deriveRewardProgress({
      size: 3,
      cells,
      lines: [line("row", 0, rewardA), line("row", 1, rewardB)],
      thresholdCount: null,
      thresholdRewardByPlayer: new Map(),
    });

    expect(expectProgress(progress, "P").lines).toEqual([
      { axis: "row", index: 0, reward: rewardA },
      { axis: "row", index: 1, reward: rewardB },
    ]);
  });

  it("earns threshold once at exactly N and above", () => {
    const cells = [
      cell(0, "me", "2026-01-01T00:00:00Z"),
      cell(1, "me", "2026-01-01T00:00:01Z"),
      cell(2, "me", "2026-01-01T00:00:02Z"),
    ];
    const atExact = deriveRewardProgress({
      size: 3,
      cells: cells.slice(0, 2),
      lines: [],
      thresholdCount: 2,
      thresholdRewardByPlayer: new Map([["me", rewardT]]),
    });
    expect(expectProgress(atExact, "me").thresholdReward).toEqual(rewardT);

    const above = deriveRewardProgress({
      size: 3,
      cells,
      lines: [],
      thresholdCount: 2,
      thresholdRewardByPlayer: new Map([["me", rewardT]]),
    });
    expect(expectProgress(above, "me").thresholdReward).toEqual(rewardT);
    expect(expectProgress(above, "me").claimedCount).toBe(3);
  });

  it("does not earn threshold below N", () => {
    const progress = deriveRewardProgress({
      size: 3,
      cells: [cell(0, "me", "2026-01-01T00:00:00Z")],
      lines: [],
      thresholdCount: 2,
      thresholdRewardByPlayer: new Map([["me", rewardT]]),
    });
    expect(expectProgress(progress, "me").thresholdReward).toBeNull();
  });

  it("never earns threshold when thresholdCount is null", () => {
    const progress = deriveRewardProgress({
      size: 3,
      cells: [cell(0, "me", "2026-01-01T00:00:00Z"), cell(1, "me", "2026-01-01T00:00:01Z")],
      lines: [],
      thresholdCount: null,
      thresholdRewardByPlayer: new Map([["me", rewardT]]),
    });
    expect(expectProgress(progress, "me").thresholdReward).toBeNull();
    expect(expectProgress(progress, "me").thresholdCount).toBeNull();
  });

  it("returns empty lines when no line definitions", () => {
    const progress = deriveRewardProgress({
      size: 3,
      cells: [
        cell(0, "me", "2026-01-01T00:00:00Z"),
        cell(1, "me", "2026-01-01T00:00:01Z"),
        cell(2, "me", "2026-01-01T00:00:02Z"),
      ],
      lines: [],
      thresholdCount: null,
      thresholdRewardByPlayer: new Map(),
    });
    expect(expectProgress(progress, "me").lines).toEqual([]);
  });

  it("does not earn threshold when player has no drawn reward", () => {
    const progress = deriveRewardProgress({
      size: 3,
      cells: [cell(0, "me", "2026-01-01T00:00:00Z"), cell(1, "me", "2026-01-01T00:00:01Z")],
      lines: [],
      thresholdCount: 2,
      thresholdRewardByPlayer: new Map([["me", null]]),
    });
    expect(progress.has("me")).toBe(true);
    expect(expectProgress(progress, "me").thresholdReward).toBeNull();
  });
});
