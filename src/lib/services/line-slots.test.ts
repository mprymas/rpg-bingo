import { describe, expect, it } from "vitest";
import { buildLineSlots } from "@/lib/services/line-slots";

const rewardA = { slug: "inspiration", label: "Inspiracja" };
const rewardB = { slug: "experience", label: "Doświadczenie" };

describe("buildLineSlots", () => {
  it("hides labels for incomplete lines when revealWhenIncomplete is false", () => {
    const slots = buildLineSlots({
      size: 3,
      cells: [
        { position: 0, claimedByColor: 1, claimedAt: "2026-01-01T00:00:00.000Z" },
        { position: 1, claimedByColor: 1, claimedAt: "2026-01-01T00:00:01.000Z" },
        { position: 2, claimedByColor: null, claimedAt: null },
      ],
      lines: [{ axis: "row", index: 0, reward: rewardA }],
      revealWhenIncomplete: false,
    });
    expect(slots).toEqual([{ axis: "row", index: 0, reward: null, claimedByColor: null }]);
  });

  it("reveals labels for incomplete lines for GM", () => {
    const slots = buildLineSlots({
      size: 3,
      cells: [
        { position: 0, claimedByColor: 1, claimedAt: "2026-01-01T00:00:00.000Z" },
        { position: 1, claimedByColor: null, claimedAt: null },
        { position: 2, claimedByColor: null, claimedAt: null },
      ],
      lines: [{ axis: "row", index: 0, reward: rewardA }],
      revealWhenIncomplete: true,
    });
    expect(slots).toEqual([{ axis: "row", index: 0, reward: rewardA, claimedByColor: null }]);
  });

  it("sets completer color to the latest claimedAt (tie → higher position)", () => {
    const slots = buildLineSlots({
      size: 3,
      cells: [
        { position: 0, claimedByColor: 1, claimedAt: "2026-01-01T00:00:02.000Z" },
        { position: 1, claimedByColor: 2, claimedAt: "2026-01-01T00:00:01.000Z" },
        { position: 2, claimedByColor: 3, claimedAt: "2026-01-01T00:00:02.000Z" },
      ],
      lines: [
        { axis: "row", index: 0, reward: rewardA },
        { axis: "column", index: 0, reward: rewardB },
      ],
      revealWhenIncomplete: false,
    });
    expect(slots.find((s) => s.axis === "row")).toEqual({
      axis: "row",
      index: 0,
      reward: rewardA,
      claimedByColor: 3,
    });
  });
});
