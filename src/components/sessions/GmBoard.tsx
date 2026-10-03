import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionPlayerRosterEntry, SessionWithCells } from "@/types";

const POLL_MS = 5000;

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

export type GmBoardCell = SessionWithCells["cells"][number];

interface Props {
  sessionId: string;
  size: number;
  initialCells: GmBoardCell[];
  initialPlayers: SessionPlayerRosterEntry[];
  /** Kitchen-sink fixtures: no polling. */
  preview?: boolean;
}

function isSessionWithCells(value: unknown): value is SessionWithCells {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.cells) && Array.isArray(record.players) && typeof record.size === "number";
}

export default function GmBoard({ sessionId, size, initialCells, initialPlayers, preview = false }: Props) {
  const [cells, setCells] = useState(initialCells);
  const [players, setPlayers] = useState(initialPlayers);
  const pollCancelledRef = useRef(false);

  useEffect(() => {
    if (preview) return;

    pollCancelledRef.current = false;

    async function poll() {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/board`);
        const data: unknown = await response.json();
        if (!response.ok || pollCancelledRef.current) return;
        if (isSessionWithCells(data)) {
          setCells(data.cells);
          setPlayers(data.players);
        }
      } catch {
        // Poll failures are non-blocking; next tick retries.
      }
    }

    const intervalId = setInterval(() => {
      void poll();
    }, POLL_MS);
    void poll();

    return () => {
      pollCancelledRef.current = true;
      clearInterval(intervalId);
    };
  }, [sessionId, preview]);

  const sorted = [...cells].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      <div className={cn("mx-auto grid max-w-md gap-1", GRID_COLS[size] ?? "grid-cols-5")}>
        {sorted.map((cell) => {
          const claimed = cell.claimedByColor != null;
          const color = cell.claimedByColor;

          return (
            <div
              key={cell.id}
              className={cn(
                "player-board-cell flex w-full flex-col items-center justify-center rounded-md border p-1.5 sm:p-2",
                !claimed && "border-border bg-card text-foreground",
                Boolean(cell.reward) && "player-board-cell-reward-frame border-transparent",
                claimed && "player-board-cell-gloss",
                claimed && color != null && PLAYER_BG[color],
                claimed && color != null && PLAYER_FG[color],
              )}
              aria-label={claimed ? (cell.reward ? `Nagroda: ${cell.reward.label}` : "Pole zajęte") : cell.phrase}
            >
              {claimed ? (
                cell.reward ? (
                  <span className="player-board-cell-reward">{cell.reward.label}</span>
                ) : null
              ) : (
                <>
                  <p className="player-board-cell-phrase">{cell.phrase}</p>
                  {cell.reward ? (
                    <Badge variant="secondary" className="mt-1 max-w-full truncate">
                      {cell.reward.label}
                    </Badge>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">Gracze</h2>
        {players.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nikt jeszcze nie dołączył</p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {players.map((player) => (
              <li key={player.id} className={cn("text-sm font-medium", PLAYER_NICK[player.color] ?? "text-foreground")}>
                {player.nick}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
