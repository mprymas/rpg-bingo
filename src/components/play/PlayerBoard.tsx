import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  ClaimConflictResponse,
  ClaimSuccessResponse,
  PlayerBoard as PlayerBoardData,
  PlayerBoardCell,
  PlayerRosterEntry,
  SessionStatus,
} from "@/types";

const POLL_MS = 5000;
const FLIP_MS = 450;
const TOAST_MS = 3000;

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

const PLAYER_BORDER: Record<number, string> = {
  1: "border-player-1",
  2: "border-player-2",
  3: "border-player-3",
  4: "border-player-4",
  5: "border-player-5",
  6: "border-player-6",
  7: "border-player-7",
  8: "border-player-8",
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

interface Props {
  code: string;
  size: number;
  initialCells: PlayerBoardCell[];
  initialPlayers?: PlayerRosterEntry[];
  initialStatus?: SessionStatus;
  initialSuccessorCode?: string | null;
  /** Nick for auto-rejoin (old-code identity else lastNick); null → manual successor entry. */
  rejoinNick?: string | null;
  /** Kitchen-sink fixtures: no claim POSTs and no polling. */
  preview?: boolean;
  /** Seed conflict copy for preview sections. */
  initialConflictMessage?: string | null;
  /** Kitchen-sink: force closed chrome / redirecting loader without live join. */
  previewClosedChrome?: "closed" | "closed-successor" | "redirecting";
}

function isPlayerBoard(value: unknown): value is PlayerBoardData {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.size === "number" &&
    Array.isArray(record.cells) &&
    Array.isArray(record.players) &&
    (record.status === "active" || record.status === "closed")
  );
}

function isClaimSuccess(value: unknown): value is ClaimSuccessResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.cell != null && typeof record.cell === "object" && record.error !== "conflict";
}

function isClaimConflict(value: unknown): value is ClaimConflictResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.error === "conflict" && record.cell != null && typeof record.cell === "object";
}

export default function PlayerBoard({
  code,
  size,
  initialCells,
  initialPlayers = [],
  initialStatus = "active",
  initialSuccessorCode = null,
  rejoinNick = null,
  preview = false,
  initialConflictMessage = null,
  previewClosedChrome,
}: Props) {
  const [cells, setCells] = useState(initialCells);
  const [players, setPlayers] = useState(initialPlayers);
  const [status, setStatus] = useState<SessionStatus>(initialStatus);
  const [successorCode, setSuccessorCode] = useState<string | null>(initialSuccessorCode);
  const [redirecting, setRedirecting] = useState(
    () => !preview && initialStatus === "closed" && Boolean(initialSuccessorCode) && Boolean(rejoinNick),
  );
  const [rejoinFailed, setRejoinFailed] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(initialConflictMessage);
  const [claimingPosition, setClaimingPosition] = useState<number | null>(null);
  const [flippingPosition, setFlippingPosition] = useState<number | null>(null);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCancelledRef = useRef(false);
  const rejoinStartedRef = useRef(false);

  const closed = status === "closed" || previewClosedChrome != null;
  const readOnly = preview || closed;
  const showRedirecting = redirecting || previewClosedChrome === "redirecting";
  const showManualSuccessor =
    Boolean(successorCode) &&
    !showRedirecting &&
    (previewClosedChrome === "closed-successor" || (closed && (!rejoinNick || rejoinFailed)));

  function showConflictToast(message: string) {
    setConflictMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    // Preview fixtures keep the toast visible for the kitchen sink.
    if (preview) return;
    toastTimerRef.current = setTimeout(() => {
      setConflictMessage(null);
    }, TOAST_MS);
  }

  const autoRejoin = useEffectEvent(async (nextCode: string, nick: string) => {
    if (rejoinStartedRef.current || preview) return;
    rejoinStartedRef.current = true;
    setRedirecting(true);
    setRejoinFailed(false);
    try {
      const body = new URLSearchParams();
      body.set("code", nextCode);
      body.set("nick", nick);
      const response = await fetch("/api/play/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        credentials: "same-origin",
      });
      const data: unknown = await response.json().catch(() => null);
      const redirect =
        data && typeof data === "object" && "redirect" in data && typeof data.redirect === "string"
          ? data.redirect
          : null;
      if (response.ok && redirect) {
        window.location.assign(redirect);
        return;
      }
      // 4xx is permanent (full / closed / bad nick) — keep the guard so polls don't re-POST.
      if (response.status >= 500) rejoinStartedRef.current = false;
      setRedirecting(false);
      setRejoinFailed(true);
    } catch {
      rejoinStartedRef.current = false;
      setRedirecting(false);
      setRejoinFailed(true);
    }
  });

  const onPolledBoard = useEffectEvent((data: PlayerBoardData) => {
    setCells(data.cells);
    setPlayers(data.players);
    setStatus(data.status);
    setSuccessorCode(data.successorCode);
    if (data.status !== "closed" || !data.successorCode || !rejoinNick) return;
    void autoRejoin(data.successorCode, rejoinNick);
  });

  useEffect(() => {
    if (preview) return;

    pollCancelledRef.current = false;

    // Defer past the effect body so auto-rejoin setState is not synchronous-in-effect.
    let rejoinTimer: ReturnType<typeof setTimeout> | null = null;
    if (initialStatus === "closed" && initialSuccessorCode && rejoinNick) {
      rejoinTimer = setTimeout(() => {
        void autoRejoin(initialSuccessorCode, rejoinNick);
      }, 0);
    }

    async function poll() {
      try {
        const response = await fetch(`/api/play/board?code=${encodeURIComponent(code)}`);
        const data: unknown = await response.json();
        if (!response.ok || pollCancelledRef.current) return;
        if (isPlayerBoard(data)) {
          onPolledBoard(data);
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
      if (rejoinTimer) clearTimeout(rejoinTimer);
    };
  }, [code, preview, initialStatus, initialSuccessorCode, rejoinNick]);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function mergeCell(next: PlayerBoardCell) {
    setCells((prev) => prev.map((cell) => (cell.position === next.position ? next : cell)));
  }

  function triggerFlip(position: number) {
    setFlippingPosition(position);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setFlippingPosition(null);
    }, FLIP_MS);
  }

  async function handleClaim(position: number) {
    if (readOnly || claimingPosition !== null) return;
    const target = cells.find((cell) => cell.position === position);
    if (!target || target.claimedByColor != null) return;

    setClaimingPosition(position);
    setConflictMessage(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    try {
      const response = await fetch("/api/play/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, position }),
      });
      const body: unknown = await response.json();

      if (response.status === 409 && isClaimConflict(body)) {
        mergeCell(body.cell);
        showConflictToast("Pole jest zajęte");
        return;
      }

      if (response.ok && isClaimSuccess(body)) {
        mergeCell(body.cell);
        triggerFlip(position);
        return;
      }

      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        showConflictToast(body.error);
        return;
      }

      showConflictToast("Nie udało się zająć pola");
    } catch {
      showConflictToast("Nie udało się zająć pola");
    } finally {
      setClaimingPosition(null);
    }
  }

  const rewardCount = cells.filter((cell) => cell.hasReward).length;
  const sorted = [...cells].sort((a, b) => a.position - b.position);

  return (
    <div className="relative space-y-4">
      {closed ? (
        <div
          className="border-border bg-muted/40 space-y-2 rounded-lg border px-4 py-3 text-center"
          role="status"
          aria-live="polite"
        >
          <p className="text-foreground text-sm font-medium">Sesja zamknięta</p>
          {showRedirecting ? (
            <p className="text-muted-foreground text-sm">Przechodzenie do nowej sesji…</p>
          ) : showManualSuccessor ? (
            <p className="text-muted-foreground text-sm">
              Nowy kod:{" "}
              <a
                href={`/play/${successorCode ?? ""}?join=1`}
                className="text-primary focus-visible:ring-ring font-mono tracking-widest outline-none hover:underline focus-visible:ring-2"
              >
                {successorCode}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {conflictMessage ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
          role="status"
          aria-live="polite"
        >
          <p className="bg-destructive text-destructive-foreground rounded-md px-3 py-2 text-center text-sm shadow-md">
            {conflictMessage}
          </p>
        </div>
      ) : null}

      <div className={cn("mx-auto grid max-w-md gap-1", GRID_COLS[size] ?? "grid-cols-5")}>
        {sorted.map((cell) => {
          const claimed = cell.claimedByColor != null;
          const free = !claimed;
          const mystery = free && cell.hasReward;
          const claimedWithReward = claimed && cell.hasReward;
          const color = cell.claimedByColor;
          const isFlipping = flippingPosition === cell.position;
          const isClaiming = claimingPosition === cell.position;

          const cellClass = cn(
            "player-board-cell flex w-full flex-col items-center justify-center rounded-md border p-1.5 sm:p-2",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            free && "border-border bg-card text-foreground",
            mystery && "player-board-cell-reward-frame border-transparent",
            claimedWithReward && "player-board-cell-reward-frame border-transparent",
            claimed && "player-board-cell-gloss",
            claimed && color != null && PLAYER_BG[color],
            claimed && !claimedWithReward && color != null && PLAYER_BORDER[color],
            claimed && color != null && PLAYER_FG[color],
            free && !readOnly && "hover:bg-accent/40 cursor-pointer",
            (claimed || readOnly) && "cursor-default",
            isClaiming && "opacity-70",
            isFlipping && "animate-player-cell-flip",
          );

          const content = free ? (
            <p className="player-board-cell-phrase">{cell.phrase}</p>
          ) : cell.reward ? (
            <span className="player-board-cell-reward">{cell.reward.label}</span>
          ) : null;

          if (free && !readOnly) {
            return (
              <button
                key={cell.position}
                type="button"
                className={cellClass}
                disabled={claimingPosition !== null}
                onClick={() => {
                  void handleClaim(cell.position);
                }}
                aria-label={`Zajmij pole: ${cell.phrase}`}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={cell.position}
              className={cellClass}
              aria-label={claimed ? (cell.reward ? `Nagroda: ${cell.reward.label}` : "Pole zajęte") : cell.phrase}
            >
              {content}
            </div>
          );
        })}
      </div>

      {rewardCount > 0 ? (
        <p className="text-muted-foreground text-center text-sm">{rewardCount} pól z nagrodą</p>
      ) : null}

      <div>
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">Gracze</h2>
        {players.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nikt jeszcze nie dołączył</p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {players.map((player) => (
              <li
                key={`${player.nick}-${player.color}-${player.created_at}`}
                className={cn("text-sm font-medium", PLAYER_NICK[player.color] ?? "text-foreground")}
              >
                {player.nick}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
