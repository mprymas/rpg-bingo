import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BoardLineSlot } from "@/types";

const GRID_COLS: Record<number, string> = {
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

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

interface Props {
  size: number;
  lineSlots: BoardLineSlot[];
  children: ReactNode;
}

function LineSlotCell({ slot, orientation }: { slot: BoardLineSlot; orientation: "row" | "column" }) {
  const complete = slot.claimedByColor != null;
  const color = slot.claimedByColor;
  const mystery = slot.reward == null;
  const label = slot.reward?.label ?? null;
  const axisLabel = orientation === "row" ? "Wiersz" : "Kolumna";
  const indexLabel = String(slot.index + 1);

  return (
    <div
      className={cn(
        "player-board-line-slot flex flex-col items-center justify-center rounded-md border p-0.5",
        !complete && "border-border bg-card text-foreground",
        mystery && !complete && "player-board-cell-reward-frame border-transparent",
        Boolean(label) && !complete && "player-board-cell-reward-frame border-transparent",
        complete && "player-board-cell-gloss",
        complete && color != null && PLAYER_BG[color],
        complete && color != null && PLAYER_FG[color],
      )}
      aria-label={
        label
          ? `${axisLabel} ${indexLabel}: ${label}${complete ? " (zdobyta)" : ""}`
          : `${axisLabel} ${indexLabel}: nagroda ukryta`
      }
    >
      {label ? (
        <span
          className={orientation === "row" ? "player-board-line-slot-row-label" : "player-board-line-slot-col-label"}
        >
          {label}
        </span>
      ) : (
        <span className="player-board-line-slot-mystery text-muted-foreground" aria-hidden>
          ?
        </span>
      )}
    </div>
  );
}

/**
 * Wraps the size×size board grid with row slots on the right and column slots on the bottom.
 * `children` must be the size² board cells in row-major order.
 */
export default function BoardWithLineSlots({ size, lineSlots, children }: Props) {
  if (lineSlots.length === 0) {
    return <div className={cn("mx-auto grid max-w-md gap-1", GRID_COLS[size] ?? "grid-cols-5")}>{children}</div>;
  }

  const rows = lineSlots
    .filter((s) => s.axis === "row")
    .slice()
    .sort((a, b) => a.index - b.index);
  const cols = lineSlots
    .filter((s) => s.axis === "column")
    .slice()
    .sort((a, b) => a.index - b.index);

  // Edge track ≈ 35% of a board-tile track → rectangular row/column reward cells.
  const edgeTrack = "minmax(0, 0.35fr)";

  return (
    <div
      className="mx-auto grid max-w-md gap-1"
      style={{
        gridTemplateColumns: `repeat(${String(size)}, minmax(0, 1fr)) ${edgeTrack}`,
        gridTemplateRows: `repeat(${String(size)}, minmax(0, 1fr)) ${edgeTrack}`,
      }}
    >
      <div
        className="grid gap-1"
        style={{
          gridColumn: `1 / span ${String(size)}`,
          gridRow: `1 / span ${String(size)}`,
          gridTemplateColumns: `repeat(${String(size)}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${String(size)}, minmax(0, 1fr))`,
        }}
      >
        {children}
      </div>
      {rows.map((slot) => (
        <div key={`row-slot-${String(slot.index)}`} style={{ gridColumn: size + 1, gridRow: slot.index + 1 }}>
          <LineSlotCell slot={slot} orientation="row" />
        </div>
      ))}
      {cols.map((slot) => (
        <div key={`col-slot-${String(slot.index)}`} style={{ gridColumn: slot.index + 1, gridRow: size + 1 }}>
          <LineSlotCell slot={slot} orientation="column" />
        </div>
      ))}
      <div style={{ gridColumn: size + 1, gridRow: size + 1 }} aria-hidden className="min-h-0" />
    </div>
  );
}
