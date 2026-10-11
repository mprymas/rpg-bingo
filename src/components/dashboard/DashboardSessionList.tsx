import { useId, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Session } from "@/types";

interface Props {
  sessions: Session[];
  /** Kitchen-sink: block real session navigation */
  demo?: boolean;
  /** Kitchen-sink: force-visible focus ring on the first visible row */
  focusDemo?: boolean;
  /** Kitchen-sink: start with closed sessions visible */
  initialShowClosed?: boolean;
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

export default function DashboardSessionList({
  sessions,
  demo = false,
  focusDemo = false,
  initialShowClosed = false,
}: Props) {
  const toggleId = useId();
  const [showClosed, setShowClosed] = useState(initialShowClosed);

  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-8 text-center">
        Nie masz jeszcze żadnej sesji
      </p>
    );
  }

  const visible = showClosed ? sessions : sessions.filter((session) => session.status === "active");

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
              <a
                href={`/sessions/${session.id}`}
                className={cn(
                  "hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex flex-col gap-1 px-4 py-3 transition-colors outline-none focus-visible:ring-2 sm:flex-row sm:items-center sm:justify-between",
                  focusDemo && index === 0 && "bg-accent ring-ring ring-2",
                )}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
