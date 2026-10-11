import { cn } from "@/lib/utils";
import type { RewardRef } from "@/types";

const PLAYER_BG: Record<number, string> = {
  1: "bg-player-1",
  2: "bg-player-2",
  3: "bg-player-3",
  4: "bg-player-4",
  5: "bg-player-5",
  6: "bg-player-6",
  7: "bg-player-7",
  8: "bg-player-8",
};

const PLAYER_FG: Record<number, string> = {
  1: "text-player-1-foreground",
  2: "text-player-2-foreground",
  3: "text-player-3-foreground",
  4: "text-player-4-foreground",
  5: "text-player-5-foreground",
  6: "text-player-6-foreground",
  7: "text-player-7-foreground",
  8: "text-player-8-foreground",
};

const PLAYER_NICK: Record<number, string> = {
  1: "text-player-1",
  2: "text-player-2",
  3: "text-player-3",
  4: "text-player-4",
  5: "text-player-5",
  6: "text-player-6",
  7: "text-player-7",
  8: "text-player-8",
};

export interface RosterListPlayer {
  key: string;
  nick: string;
  color: number;
  claimedCount: number;
  /** Earned threshold reward (color + label for players). */
  thresholdReward: RewardRef | null;
  /** GM: pre-drawn reward shown before the threshold is met. */
  thresholdRewardAssigned?: RewardRef | null;
}

interface Props {
  players: RosterListPlayer[];
  thresholdCount: number | null;
  /** Board size (3–5) — threshold tile width matches one board cell. */
  boardSize: number;
  /** When true, show assigned reward labels before they are earned (GM). */
  revealAssigned?: boolean;
}

function ThresholdTile({
  color,
  earned,
  label,
  mystery,
}: {
  color: number;
  earned: boolean;
  label: string | null;
  mystery: boolean;
}) {
  return (
    <div
      className={cn(
        "player-roster-threshold-tile flex shrink-0 items-center justify-center rounded-md border px-1",
        !earned && "border-border bg-card text-foreground",
        mystery && !earned && "player-board-cell-reward-frame border-transparent",
        Boolean(label) && !earned && "player-board-cell-reward-frame border-transparent",
        earned && "player-board-cell-gloss",
        earned && PLAYER_BG[color],
        earned && PLAYER_FG[color],
      )}
      aria-label={
        label
          ? earned
            ? `Nagroda progowa: ${label}`
            : `Nagroda progowa (jeszcze nie): ${label}`
          : "Nagroda progowa ukryta"
      }
    >
      {label ? (
        <span className="player-roster-threshold-label">{label}</span>
      ) : (
        <span className="player-board-line-slot-mystery text-muted-foreground" aria-hidden>
          ?
        </span>
      )}
    </div>
  );
}

/** One board-cell width inside the max-w-md board grid (gap-1). */
function boardCellWidthCss(size: number): string {
  const cols = Math.max(3, Math.min(5, size));
  const gaps = cols - 1;
  return `calc((min(100vw - 2rem, 28rem) - 0.25rem * ${String(gaps)}) / ${String(cols)})`;
}

export default function PlayerRosterList({ players, thresholdCount, boardSize, revealAssigned = false }: Props) {
  const showThreshold = thresholdCount != null;
  const cellWidth = boardCellWidthCss(boardSize);

  return (
    <div style={{ ["--roster-cell-width" as string]: cellWidth }}>
      <h2 className="text-muted-foreground mb-3 text-sm font-medium">Gracze</h2>
      {players.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nikt jeszcze nie dołączył</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((player) => {
            const earned = player.thresholdReward != null;
            const assigned = player.thresholdRewardAssigned ?? null;
            const label = earned
              ? (player.thresholdReward?.label ?? null)
              : revealAssigned
                ? (assigned?.label ?? null)
                : null;
            const mystery = showThreshold && !earned && !revealAssigned;
            const fraction = showThreshold ? `${String(player.claimedCount)}/${String(thresholdCount)}` : null;
            const fillPct =
              showThreshold && thresholdCount > 0 ? Math.min(100, (player.claimedCount / thresholdCount) * 100) : 0;

            return (
              <li key={player.key} className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "w-24 shrink-0 truncate text-sm font-medium sm:w-28",
                    PLAYER_NICK[player.color] ?? "text-foreground",
                  )}
                >
                  {player.nick}
                </span>
                {showThreshold ? (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div
                        className="bg-muted relative h-2 min-w-0 flex-1 overflow-hidden rounded-full"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={thresholdCount}
                        aria-valuenow={player.claimedCount}
                        aria-label={`Postęp do nagrody: ${fraction ?? ""}`}
                      >
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full",
                            PLAYER_BG[player.color] ?? "bg-primary",
                          )}
                          style={{ width: `${String(fillPct)}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">{fraction}</span>
                    </div>
                    <ThresholdTile
                      color={player.color}
                      earned={earned}
                      label={label}
                      mystery={mystery || Boolean(label && !earned)}
                    />
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
