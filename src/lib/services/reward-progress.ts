import type { LineAxis, PlayerRewardProgress, RewardRef } from "@/types";

interface ClaimCell {
  position: number;
  claimedBy: string | null;
  claimedAt: string | null;
}

interface ClaimedCell {
  position: number;
  claimedBy: string;
  claimedAt: string;
}

function linePositions(size: number, axis: LineAxis, index: number): number[] {
  if (axis === "row") {
    const start = index * size;
    return Array.from({ length: size }, (_, i) => start + i);
  }
  return Array.from({ length: size }, (_, i) => index + i * size);
}

/** True when `a` is a later claim than `b` (claimedAt, then higher position). */
function isLaterClaim(a: ClaimedCell, b: ClaimedCell): boolean {
  if (a.claimedAt > b.claimedAt) return true;
  if (a.claimedAt < b.claimedAt) return false;
  return a.position > b.position;
}

/**
 * Derive per-player claimed counts, completed line rewards, and threshold earnings.
 * `claimedBy` is an opaque key (GM: player id; player path: `"me"` / `"other"`).
 */
export function deriveRewardProgress(input: {
  size: number;
  cells: ClaimCell[];
  lines: { axis: LineAxis; index: number; reward: RewardRef }[];
  thresholdCount: number | null;
  thresholdRewardByPlayer: Map<string, RewardRef | null>;
}): Map<string, PlayerRewardProgress> {
  const byPosition = new Map<number, ClaimCell>();
  for (const cell of input.cells) {
    byPosition.set(cell.position, cell);
  }

  const claimedCountByPlayer = new Map<string, number>();
  for (const cell of input.cells) {
    if (cell.claimedBy == null) continue;
    claimedCountByPlayer.set(cell.claimedBy, (claimedCountByPlayer.get(cell.claimedBy) ?? 0) + 1);
  }

  const linesByPlayer = new Map<string, PlayerRewardProgress["lines"]>();
  for (const line of input.lines) {
    const positions = linePositions(input.size, line.axis, line.index);
    const members: ClaimedCell[] = [];
    let complete = true;
    for (const p of positions) {
      const m = byPosition.get(p);
      if (m?.claimedBy == null || m.claimedAt == null) {
        complete = false;
        break;
      }
      members.push({ position: m.position, claimedBy: m.claimedBy, claimedAt: m.claimedAt });
    }
    if (!complete || members.length === 0) continue;

    let completer = members[0];
    for (let i = 1; i < members.length; i++) {
      const candidate = members[i];
      if (isLaterClaim(candidate, completer)) {
        completer = candidate;
      }
    }

    const playerKey = completer.claimedBy;
    const earned = linesByPlayer.get(playerKey) ?? [];
    earned.push({ axis: line.axis, index: line.index, reward: line.reward });
    linesByPlayer.set(playerKey, earned);
  }

  const keys = new Set<string>([...claimedCountByPlayer.keys(), ...input.thresholdRewardByPlayer.keys()]);

  const result = new Map<string, PlayerRewardProgress>();
  for (const key of keys) {
    const claimedCount = claimedCountByPlayer.get(key) ?? 0;
    const drawn = input.thresholdRewardByPlayer.get(key);
    const thresholdReward =
      input.thresholdCount != null && claimedCount >= input.thresholdCount && drawn != null ? drawn : null;

    result.set(key, {
      claimedCount,
      thresholdCount: input.thresholdCount,
      thresholdReward,
      lines: linesByPlayer.get(key) ?? [],
    });
  }

  return result;
}
