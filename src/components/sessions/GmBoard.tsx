import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BoardWithLineSlots from "@/components/play/BoardWithLineSlots";
import PlayerRosterList from "@/components/play/PlayerRosterList";
import {
  GM_BOARD_CANCEL_EDIT_EVENT,
  GM_BOARD_COMMIT_EDIT_EVENT,
  GM_BOARD_ENTER_EDIT_EVENT,
  publishGmBoardEditState,
  readGmBoardEnterEditDetail,
} from "@/components/sessions/gm-board-edit";
import { cn } from "@/lib/utils";
import type { BoardLineSlot, SessionPlayerRosterEntry, SessionWithCells, UndoClaimSuccessResponse } from "@/types";

const POLL_MS = 5000;

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

export type GmBoardCell = SessionWithCells["cells"][number];

interface PhraseOverride {
  position: number;
  phrase: string;
}

interface Props {
  sessionId: string;
  size: number;
  initialCells: GmBoardCell[];
  initialPlayers: SessionPlayerRosterEntry[];
  /** Pre-drawn row/column edge slots (labels always visible for GM). */
  initialLineRewards?: BoardLineSlot[];
  /** Session threshold N; used for roster labels. */
  thresholdCount?: number | null;
  /** When not `"active"`, claimed cells stay non-interactive. */
  sessionStatus?: string;
  /** Kitchen-sink fixtures: no polling; undo and reroll POSTs are local no-ops. */
  preview?: boolean;
  /** Kitchen-sink: seed confirm chrome on a claimed cell position. */
  initialConfirmPosition?: number | null;
  /** Kitchen-sink: seed busy spinner inside confirm chrome. */
  initialPending?: boolean;
  /** Kitchen-sink: seed undo or draw error banner. */
  initialError?: string | null;
  /** Kitchen-sink: seed edit mode. Entry on the live page is the header pencil. */
  initialEditing?: boolean;
  /** Kitchen-sink: seed tab-local phrase overrides. */
  initialOverrides?: PhraseOverride[];
  /** Kitchen-sink: seed the claimed-commit rejection banner. */
  initialRejectedPositions?: number[];
}

function isRewardRefValue(value: unknown): value is { slug: string; label: string } {
  if (!value || typeof value !== "object") return false;
  const reward = value as Record<string, unknown>;
  return typeof reward.slug === "string" && typeof reward.label === "string";
}

function isEarnedRoster(value: unknown): value is SessionPlayerRosterEntry["earned"] {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.claimedCount !== "number" || !Array.isArray(record.lines) || !Array.isArray(record.fieldRewards)) {
    return false;
  }
  if (record.thresholdReward != null && !isRewardRefValue(record.thresholdReward)) return false;
  if (record.thresholdRewardAssigned != null && !isRewardRefValue(record.thresholdRewardAssigned)) return false;
  for (const line of record.lines) {
    if (!line || typeof line !== "object") return false;
    const entry = line as Record<string, unknown>;
    if (
      (entry.axis !== "row" && entry.axis !== "column") ||
      typeof entry.index !== "number" ||
      !isRewardRefValue(entry.reward)
    ) {
      return false;
    }
  }
  for (const reward of record.fieldRewards) {
    if (!isRewardRefValue(reward)) return false;
  }
  return true;
}

function isSessionWithCells(value: unknown): value is SessionWithCells {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record.cells) ||
    !Array.isArray(record.players) ||
    typeof record.size !== "number" ||
    !Array.isArray(record.lineRewards)
  ) {
    return false;
  }
  for (const player of record.players) {
    if (!player || typeof player !== "object") return false;
    const entry = player as Record<string, unknown>;
    if (entry.earned != null && !isEarnedRoster(entry.earned)) return false;
  }
  return true;
}

function isUndoClaimSuccess(value: unknown): value is UndoClaimSuccessResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (!record.cell || typeof record.cell !== "object") return false;
  const cell = record.cell as Record<string, unknown>;
  return typeof cell.position === "number" && typeof cell.id === "string";
}

function isRerollSuccess(value: unknown): value is { phrase: string } {
  if (!value || typeof value !== "object") return false;
  const phrase = (value as { phrase?: unknown }).phrase;
  return typeof phrase === "string" && phrase.length > 0;
}

function isCommitSuccess(value: unknown): value is { cells: GmBoardCell[] } {
  if (!value || typeof value !== "object") return false;
  const cells = (value as { cells?: unknown }).cells;
  if (!Array.isArray(cells)) return false;
  return cells.every((cell) => {
    if (!cell || typeof cell !== "object") return false;
    const record = cell as Record<string, unknown>;
    return typeof record.position === "number" && typeof record.id === "string" && typeof record.phrase === "string";
  });
}

function readJsonError(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  return typeof value.error === "string" ? value.error : null;
}

function readClaimedPositions(value: unknown): number[] | null {
  if (!value || typeof value !== "object" || !("positions" in value)) return null;
  const raw = value.positions;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const positions: number[] = [];
  for (const position of raw) {
    if (typeof position !== "number" || !Number.isInteger(position)) return null;
    positions.push(position);
  }
  return positions;
}

function freeCellLocally(cell: GmBoardCell): GmBoardCell {
  return { ...cell, claimedByColor: null };
}

function overrideList(overrides: ReadonlyMap<number, string>): PhraseOverride[] {
  return [...overrides.entries()]
    .map(([position, phrase]) => ({ position, phrase }))
    .sort((a, b) => a.position - b.position);
}

export default function GmBoard({
  sessionId,
  size,
  initialCells,
  initialPlayers,
  initialLineRewards = [],
  thresholdCount = null,
  sessionStatus,
  preview = false,
  initialConfirmPosition = null,
  initialPending = false,
  initialError = null,
  initialEditing = false,
  initialOverrides,
  initialRejectedPositions = [],
}: Props) {
  const [cells, setCells] = useState(initialCells);
  const [players, setPlayers] = useState(initialPlayers);
  const [lineRewards, setLineRewards] = useState(initialLineRewards);
  const [thresholdN, setThresholdN] = useState(thresholdCount);
  const [confirmPosition, setConfirmPosition] = useState<number | null>(initialConfirmPosition);
  const [pending, setPending] = useState(initialPending);
  const [error, setError] = useState<string | null>(initialError);
  const [editing, setEditing] = useState(initialEditing);
  const [overrides, setOverrides] = useState(
    () => new Map((initialOverrides ?? []).map((item) => [item.position, item.phrase] as const)),
  );
  const [rejectedPositions, setRejectedPositions] = useState<number[]>(initialRejectedPositions);
  const [drawingPosition, setDrawingPosition] = useState<number | null>(null);
  const [committing, setCommitting] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const pollCancelledRef = useRef(false);
  const confirmPositionRef = useRef<number | null>(initialConfirmPosition);
  const pendingRef = useRef(initialPending);
  const rerollBusyRef = useRef(false);
  const cancelEditRef = useRef<() => void>(() => undefined);
  const commitDraftRef = useRef<() => void>(() => undefined);

  const undoEnabled = sessionStatus === "active";
  const rerollBusy = drawingPosition !== null || committing;
  const overrideCount = overrides.size;

  useEffect(() => {
    publishGmBoardEditState({
      sessionId,
      editing,
      canCommit: overrideCount > 0,
      busy: pending || rerollBusy,
      committing,
    });
  }, [sessionId, editing, overrideCount, pending, rerollBusy, committing]);

  useEffect(() => {
    confirmPositionRef.current = confirmPosition;
    pendingRef.current = pending;
  }, [confirmPosition, pending]);

  useEffect(() => {
    function onEnterEdit(event: Event) {
      const detail = readGmBoardEnterEditDetail(event);
      if (detail?.sessionId !== sessionId) return;
      if (sessionStatus !== "active") return;
      if (pendingRef.current || rerollBusyRef.current) return;
      setEditing(true);
      setOverrides(new Map());
      setRejectedPositions([]);
      setError(null);
      setConfirmPosition(null);
    }

    function onCancelEdit(event: Event) {
      const detail = readGmBoardEnterEditDetail(event);
      if (detail?.sessionId !== sessionId) return;
      cancelEditRef.current();
    }

    function onCommitEdit(event: Event) {
      const detail = readGmBoardEnterEditDetail(event);
      if (detail?.sessionId !== sessionId) return;
      commitDraftRef.current();
    }

    window.addEventListener(GM_BOARD_ENTER_EDIT_EVENT, onEnterEdit);
    window.addEventListener(GM_BOARD_CANCEL_EDIT_EVENT, onCancelEdit);
    window.addEventListener(GM_BOARD_COMMIT_EDIT_EVENT, onCommitEdit);
    return () => {
      window.removeEventListener(GM_BOARD_ENTER_EDIT_EVENT, onEnterEdit);
      window.removeEventListener(GM_BOARD_CANCEL_EDIT_EVENT, onCancelEdit);
      window.removeEventListener(GM_BOARD_COMMIT_EDIT_EVENT, onCommitEdit);
    };
  }, [sessionId, sessionStatus]);

  const refreshSnapshot = useEffectEvent(async () => {
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
        setLineRewards(data.lineRewards);
        setThresholdN(data.threshold_count);
      }
    } catch {
      // Poll failures are non-blocking; next tick retries.
    }
  });

  useEffect(() => {
    if (preview) return;

    pollCancelledRef.current = false;

    const intervalId = setInterval(() => {
      void refreshSnapshot();
    }, POLL_MS);
    void refreshSnapshot();

    return () => {
      pollCancelledRef.current = true;
      clearInterval(intervalId);
    };
  }, [sessionId, preview]);

  useEffect(() => {
    if (preview || refreshTick === 0) return;
    void refreshSnapshot();
  }, [preview, refreshTick]);

  function enterConfirm(position: number) {
    if (!undoEnabled || pending || rerollBusyRef.current) return;
    setError(null);
    setConfirmPosition(position);
  }

  function cancelConfirm() {
    if (pending) return;
    setConfirmPosition(null);
  }

  function cancelEdit() {
    if (pending || rerollBusyRef.current) return;
    setEditing(false);
    setOverrides(new Map());
    setRejectedPositions([]);
    setError(null);
    setConfirmPosition(null);
  }

  function dropRejected() {
    if (pending || rerollBusyRef.current) return;
    setOverrides((current) => {
      const next = new Map(current);
      for (const position of rejectedPositions) {
        next.delete(position);
      }
      return next;
    });
    setRejectedPositions([]);
  }

  async function drawPhrase(position: number) {
    if (!undoEnabled || pending || rerollBusyRef.current) return;
    rerollBusyRef.current = true;
    setDrawingPosition(position);
    setError(null);

    try {
      if (preview) return;

      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/reroll-phrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position,
          overrides: overrideList(overrides),
        }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || !isRerollSuccess(data)) {
        setError(readJsonError(data) ?? "Nie udało się wylosować hasła");
        return;
      }

      setOverrides((current) => {
        const next = new Map(current);
        next.set(position, data.phrase);
        return next;
      });
    } catch {
      setError("Nie udało się wylosować hasła");
    } finally {
      rerollBusyRef.current = false;
      setDrawingPosition(null);
    }
  }

  async function commitDraft() {
    const changes = overrideList(overrides);
    if (!undoEnabled || pending || rerollBusyRef.current || changes.length === 0) return;
    rerollBusyRef.current = true;
    setCommitting(true);
    setError(null);

    try {
      if (preview) {
        setCells((prev) =>
          prev.map((cell) => {
            const phrase = overrides.get(cell.position);
            return phrase !== undefined ? { ...cell, phrase } : cell;
          }),
        );
        setOverrides(new Map());
        setRejectedPositions([]);
        setEditing(false);
        setConfirmPosition(null);
        return;
      }

      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/commit-phrase-rerolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (response.status === 409) {
        const positions = readClaimedPositions(data);
        if (positions) {
          setRejectedPositions(positions);
          setError(null);
          return;
        }
      }

      if (!response.ok || !isCommitSuccess(data)) {
        setError(readJsonError(data) ?? "Nie udało się zatwierdzić haseł");
        return;
      }

      const committed = new Map(data.cells.map((cell) => [cell.position, cell]));
      setCells((prev) => prev.map((cell) => committed.get(cell.position) ?? cell));
      setOverrides(new Map());
      setRejectedPositions([]);
      setEditing(false);
      setConfirmPosition(null);
      setRefreshTick((tick) => tick + 1);
    } catch {
      setError("Nie udało się zatwierdzić haseł");
    } finally {
      rerollBusyRef.current = false;
      setCommitting(false);
    }
  }

  useEffect(() => {
    cancelEditRef.current = cancelEdit;
    commitDraftRef.current = () => {
      void commitDraft();
    };
  });

  async function confirmUndo(position: number) {
    if (!undoEnabled || pending || rerollBusyRef.current) return;

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
      setRefreshTick((tick) => tick + 1);
    } catch {
      setError("Nie udało się cofnąć oznaczenia");
      setPending(false);
    }
  }

  function activateCell(cell: GmBoardCell) {
    if (pending || rerollBusyRef.current || confirmPosition === cell.position) return;
    const claimed = cell.claimedByColor != null;
    const hasOverride = editing && overrides.has(cell.position);
    if (editing && claimed && hasOverride) return;
    if (editing && !claimed && undoEnabled) {
      void drawPhrase(cell.position);
      return;
    }
    if (claimed && undoEnabled) {
      enterConfirm(cell.position);
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

      {editing && rejectedPositions.length > 0 ? (
        <div
          className="border-border bg-background flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4"
          role="alert"
        >
          <p className="text-destructive text-sm">Pole jest już zajęte: {rejectedPositions.join(", ")}</p>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={pending || rerollBusy}
            onClick={dropRejected}
          >
            Usuń zajęte ze szkicu
          </Button>
        </div>
      ) : null}

      {editing ? (
        <p className="text-muted-foreground text-center text-sm">Kliknięcie w wolne pole wylosuje nowe hasło.</p>
      ) : null}

      <BoardWithLineSlots size={size} lineSlots={lineRewards}>
        {sorted.map((cell) => {
          const claimed = cell.claimedByColor != null;
          const color = cell.claimedByColor;
          const inConfirm = confirmPosition === cell.position;
          const draftPhrase = overrides.get(cell.position);
          const hasOverride = editing && draftPhrase !== undefined;
          const shownPhrase = hasOverride ? draftPhrase : cell.phrase;
          const drawing = drawingPosition === cell.position;
          const canDraw = editing && !claimed && undoEnabled;
          const canUndo = claimed && undoEnabled && !(editing && hasOverride);
          const interactive = !pending && !rerollBusy && !inConfirm && (canDraw || canUndo);

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
                interactive && "cursor-pointer",
                ((inConfirm && pending) || drawing) && "opacity-80",
              )}
              aria-label={claimed ? (cell.reward ? `Nagroda: ${cell.reward.label}` : "Pole zajęte") : shownPhrase}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={() => {
                activateCell(cell);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activateCell(cell);
                }
              }}
            >
              {claimed ? (
                cell.reward ? (
                  <span className="player-board-cell-reward">{cell.reward.label}</span>
                ) : null
              ) : (
                <>
                  <p className={cn("player-board-cell-phrase", cell.reward && "player-board-cell-phrase-with-reward")}>
                    {shownPhrase}
                  </p>
                  {cell.reward ? (
                    <Badge
                      variant="secondary"
                      className="player-board-cell-reward-badge mt-0.5 block w-auto max-w-full min-w-0 shrink-0 font-normal"
                    >
                      {cell.reward.label}
                    </Badge>
                  ) : null}
                </>
              )}

              {drawing ? (
                <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center">
                  <span
                    className="border-foreground/30 border-t-foreground size-5 animate-spin rounded-full border-2"
                    aria-label="Losowanie hasła"
                  />
                </div>
              ) : null}

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
      </BoardWithLineSlots>

      <PlayerRosterList
        players={players.map((player) => ({
          key: player.id,
          nick: player.nick,
          color: player.color,
          claimedCount: player.earned.claimedCount,
          thresholdReward: player.earned.thresholdReward,
          thresholdRewardAssigned: player.earned.thresholdRewardAssigned,
        }))}
        thresholdCount={thresholdN}
        boardSize={size}
        revealAssigned
      />
    </div>
  );
}
