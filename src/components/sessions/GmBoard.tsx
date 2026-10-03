import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SessionPlayerRosterEntry, SessionWithCells, UndoClaimSuccessResponse } from "@/types";

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
  /** When not `"active"`, claimed cells stay non-interactive. */
  sessionStatus?: string;
  /** Kitchen-sink fixtures: no polling; undo POST is a local no-op. */
  preview?: boolean;
  /** Kitchen-sink: seed confirm chrome on a claimed cell position. */
  initialConfirmPosition?: number | null;
  /** Kitchen-sink: seed busy spinner inside confirm chrome. */
  initialPending?: boolean;
  /** Kitchen-sink: seed undo error banner. */
  initialError?: string | null;
}

function isSessionWithCells(value: unknown): value is SessionWithCells {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.cells) && Array.isArray(record.players) && typeof record.size === "number";
}

function isUndoClaimSuccess(value: unknown): value is UndoClaimSuccessResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!record.cell || typeof record.cell !== "object") return false;
  const cell = record.cell as Record<string, unknown>;
  return typeof cell.position === "number" && typeof cell.id === "string";
}

function readJsonError(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  return typeof value.error === "string" ? value.error : null;
}

function freeCellLocally(cell: GmBoardCell): GmBoardCell {
  return { ...cell, claimedByColor: null };
}

export default function GmBoard({
  sessionId,
  size,
  initialCells,
  initialPlayers,
  sessionStatus,
  preview = false,
  initialConfirmPosition = null,
  initialPending = false,
  initialError = null,
}: Props) {
  const [cells, setCells] = useState(initialCells);
  const [players, setPlayers] = useState(initialPlayers);
  const [confirmPosition, setConfirmPosition] = useState<number | null>(initialConfirmPosition);
  const [pending, setPending] = useState(initialPending);
  const [error, setError] = useState<string | null>(initialError);
  const pollCancelledRef = useRef(false);
  const confirmPositionRef = useRef<number | null>(initialConfirmPosition);

  const undoEnabled = sessionStatus === "active";

  useEffect(() => {
    confirmPositionRef.current = confirmPosition;
  }, [confirmPosition]);

  useEffect(() => {
    if (preview) return;

    pollCancelledRef.current = false;

    async function poll() {
      try {
        const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/board`);
        const data: unknown = await response.json();
        if (!response.ok || pollCancelledRef.current) return;
        if (isSessionWithCells(data)) {
          const lockPosition = confirmPositionRef.current;

          setCells((prev) => {
            if (lockPosition == null) return data.cells;
            return data.cells.map((incoming) => {
              if (incoming.position !== lockPosition) return incoming;
              return prev.find((cell) => cell.position === lockPosition) ?? incoming;
            });
          });
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

  function enterConfirm(position: number) {
    if (!undoEnabled || pending) return;
    setError(null);
    setConfirmPosition(position);
  }

  function cancelConfirm() {
    if (pending) return;
    setConfirmPosition(null);
  }

  async function confirmUndo(position: number) {
    if (!undoEnabled || pending) return;

    setPending(true);
    setError(null);

    if (preview) {
      setCells((prev) => prev.map((cell) => (cell.position === position ? freeCellLocally(cell) : cell)));
      setConfirmPosition(null);
      setPending(false);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/undo-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || !isUndoClaimSuccess(data)) {
        const message = readJsonError(data) ?? "Nie udało się cofnąć oznaczenia";
        setError(message);
        setPending(false);
        return;
      }

      setCells((prev) => prev.map((cell) => (cell.position === data.cell.position ? data.cell : cell)));
      setConfirmPosition(null);
      setPending(false);
    } catch {
      setError("Nie udało się cofnąć oznaczenia");
      setPending(false);
    }
  }

  const sorted = [...cells].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-destructive text-center text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className={cn("mx-auto grid max-w-md gap-1", GRID_COLS[size] ?? "grid-cols-5")}>
        {sorted.map((cell) => {
          const claimed = cell.claimedByColor != null;
          const color = cell.claimedByColor;
          const inConfirm = confirmPosition === cell.position;
          const canUndo = claimed && undoEnabled;
          const interactive = canUndo && !pending;

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
                interactive && !inConfirm && "cursor-pointer",
                inConfirm && pending && "opacity-80",
              )}
              aria-label={claimed ? (cell.reward ? `Nagroda: ${cell.reward.label}` : "Pole zajęte") : cell.phrase}
              role={interactive && !inConfirm ? "button" : undefined}
              tabIndex={interactive && !inConfirm ? 0 : undefined}
              onClick={() => {
                if (!canUndo || pending || inConfirm) return;
                enterConfirm(cell.position);
              }}
              onKeyDown={(event) => {
                if (!canUndo || pending || inConfirm) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  enterConfirm(cell.position);
                }
              }}
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

              {inConfirm ? (
                <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center gap-1 p-1">
                  {pending ? (
                    <span
                      className="border-foreground/30 border-t-foreground size-5 animate-spin rounded-full border-2"
                      aria-label="Cofanie oznaczenia"
                    />
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        className="bg-success text-success-foreground hover:bg-success/90 size-7 cursor-pointer"
                        aria-label="Cofnij oznaczenie"
                        disabled={pending}
                        onClick={(event) => {
                          event.stopPropagation();
                          void confirmUndo(cell.position);
                        }}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="size-7 cursor-pointer"
                        aria-label="Anuluj"
                        disabled={pending}
                        onClick={(event) => {
                          event.stopPropagation();
                          cancelConfirm();
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
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
