import type { BoardLineSlot, LineAxis, RewardRef } from "@/types";

export interface LineSlotCell {
  position: number;
  claimedByColor: number | null;
  claimedAt: string | null;
}

interface ClaimedSlotCell {
  position: number;
  claimedByColor: number;
  claimedAt: string;
}

function linePositions(size: number, axis: LineAxis, index: number): number[] {
  if (axis === "row") {
    const start = index * size;
    return Array.from({ length: size }, (_, i) => start + i);
  }
  return Array.from({ length: size }, (_, i) => index + i * size);
}

function isLater(a: ClaimedSlotCell, b: ClaimedSlotCell): boolean {
  if (a.claimedAt > b.claimedAt) return true;
  if (a.claimedAt < b.claimedAt) return false;
  return a.position > b.position;
}

/** Completer = latest claimedAt, tie → higher position (same as deriveRewardProgress). */
function completerColor(size: number, axis: LineAxis, index: number, cells: LineSlotCell[]): number | null {
  const byPosition = new Map(cells.map((cell) => [cell.position, cell]));
  const members: ClaimedSlotCell[] = [];
  for (const p of linePositions(size, axis, index)) {
    const m = byPosition.get(p);
    if (m?.claimedByColor == null || m.claimedAt == null) return null;
    members.push({ position: m.position, claimedByColor: m.claimedByColor, claimedAt: m.claimedAt });
  }
  if (members.length === 0) return null;

  let best = members[0];
  for (let i = 1; i < members.length; i++) {
    const candidate = members[i];
    if (isLater(candidate, best)) best = candidate;
  }
  return best.claimedByColor;
}

/**
 * Build edge slots for row/column rewards.
 * GM: `revealWhenIncomplete: true` — labels always visible, color only when complete.
 */
export function buildLineSlots(input: {
  size: number;
  cells: LineSlotCell[];
  lines: { axis: LineAxis; index: number; reward: RewardRef }[];
  revealWhenIncomplete: boolean;
}): BoardLineSlot[] {
  return input.lines.map((line) => {
    const color = completerColor(input.size, line.axis, line.index, input.cells);
    const complete = color != null;
    return {
      axis: line.axis,
      index: line.index,
      reward: complete || input.revealWhenIncomplete ? line.reward : null,
      claimedByColor: color,
    };
  });
}
