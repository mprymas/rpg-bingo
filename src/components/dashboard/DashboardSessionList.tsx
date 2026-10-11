import { useId, useState } from "react";
import { useDeleteSession } from "@/components/hooks/useDeleteSession";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Session } from "@/types";

interface Props {
  sessions: Session[];
  /** Kitchen-sink: block real session navigation and delete API */
  demo?: boolean;
  /** Kitchen-sink: force-visible focus ring on the first visible row */
  focusDemo?: boolean;
  /** Kitchen-sink: start with closed sessions visible */
  initialShowClosed?: boolean;
  /** Kitchen-sink: open delete confirm for this session id */
  initialDeleteOpenId?: string;
  /** Kitchen-sink: seed delete error message in the open dialog */
  initialDeleteError?: string | null;
}

function statusLabel(status: string) {
  return status === "active" ? "Aktywna" : "Zamknięta";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function deleteWarningCopy(status: string) {
  if (status === "active") {
    return "Tej operacji nie można cofnąć. Gracze stracą dostęp do aktywnej planszy — kod sesji przestanie działać.";
  }
  return "Tej operacji nie można cofnąć. Sesja zniknie z listy na stałe.";
}

export default function DashboardSessionList({
  sessions,
  demo = false,
  focusDemo = false,
  initialShowClosed = false,
  initialDeleteOpenId,
  initialDeleteError = null,
}: Props) {
  const toggleId = useId();
  const [showClosed, setShowClosed] = useState(initialShowClosed);
  const [target, setTarget] = useState<Session | null>(() => {
    if (!initialDeleteOpenId) return null;
    return sessions.find((session) => session.id === initialDeleteOpenId) ?? null;
  });
  const { pending, error, setError, deleteSession } = useDeleteSession();
  const [seededError] = useState(initialDeleteError);
  const shownError = error ?? (target ? seededError : null);

  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-8 text-center">
        Nie masz jeszcze żadnej sesji
      </p>
    );
  }

  const visible = showClosed ? sessions : sessions.filter((session) => session.status === "active");

  async function handleConfirmDelete() {
    if (!target || pending) return;

    if (demo) {
      setTarget(null);
      setError(null);
      return;
    }

    await deleteSession(target.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={toggleId}
          checked={showClosed}
          onCheckedChange={(checked) => {
            setShowClosed(checked === true);
          }}
        />
        <Label htmlFor={toggleId} className="text-foreground cursor-pointer font-normal">
          Pokaż zamknięte
        </Label>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-8 text-center">
          Brak aktywnych sesji
        </p>
      ) : (
        <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
          {visible.map((session, index) => (
            <li key={session.id}>
              <div className={cn("flex items-stretch", focusDemo && index === 0 && "bg-accent ring-ring ring-2")}>
                <a
                  href={`/sessions/${session.id}`}
                  className="hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 transition-colors outline-none focus-visible:ring-2 sm:flex-row sm:items-center sm:justify-between"
                  tabIndex={focusDemo && index === 0 ? 0 : undefined}
                  onClick={(event) => {
                    if (demo) event.preventDefault();
                  }}
                >
                  <span className="text-foreground font-mono text-lg tracking-widest">{session.code}</span>
                  <span className="text-muted-foreground flex flex-wrap gap-3 text-sm">
                    <span>
                      {session.size}×{session.size}
                    </span>
                    <span>{statusLabel(session.status)}</span>
                    <span>{formatDate(session.created_at)}</span>
                  </span>
                </a>
                <div className="flex shrink-0 items-center pr-2 pl-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setError(null);
                      setTarget(session);
                    }}
                  >
                    Usuń
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {demo && target ? (
        <div className="border-border bg-background grid gap-4 rounded-lg border p-6 shadow-lg">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <h3 className="text-lg font-semibold">Usunąć sesję {target.code}?</h3>
            <p className="text-muted-foreground text-sm">{deleteWarningCopy(target.status)}</p>
          </div>
          {shownError ? <p className="text-destructive text-sm">{shownError}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setTarget(null);
                setError(null);
              }}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                void handleConfirmDelete();
              }}
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />
                  Usuwanie…
                </span>
              ) : (
                "Usuń"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <AlertDialog
          open={target !== null}
          onOpenChange={(open) => {
            if (pending) return;
            if (!open) {
              setTarget(null);
              setError(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usunąć sesję {target?.code}?</AlertDialogTitle>
              <AlertDialogDescription>{target ? deleteWarningCopy(target.status) : null}</AlertDialogDescription>
            </AlertDialogHeader>
            {shownError ? <p className="text-destructive text-sm">{shownError}</p> : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Anuluj</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  void handleConfirmDelete();
                }}
              >
                {pending ? (
                  <span className="flex items-center gap-2">
                    <span className="border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />
                    Usuwanie…
                  </span>
                ) : (
                  "Usuń"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
