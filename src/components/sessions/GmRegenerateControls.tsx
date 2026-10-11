import { useState } from "react";
import { flushSync } from "react-dom";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  sessionId: string;
  /** When not `"active"`, the regenerate CTA is hidden. */
  sessionStatus?: string;
  /** Kitchen-sink: seed confirm chrome open. */
  initialConfirmOpen?: boolean;
  /** Kitchen-sink: no navigation. */
  preview?: boolean;
}

export default function GmRegenerateControls({
  sessionId,
  sessionStatus,
  initialConfirmOpen = false,
  preview = false,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(initialConfirmOpen);
  const [navigating, setNavigating] = useState(false);

  if (sessionStatus !== "active") {
    return null;
  }

  function handleConfirm() {
    if (navigating) return;
    if (preview) {
      setConfirmOpen(false);
      return;
    }
    flushSync(() => {
      setNavigating(true);
    });
    window.location.assign(`/sessions/new?from=${encodeURIComponent(sessionId)}`);
  }

  if (!confirmOpen) {
    return (
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setConfirmOpen(true);
          }}
        >
          <RefreshCw className="size-4" />
          Wygeneruj nową planszę
        </Button>
      </div>
    );
  }

  return (
    <div
      className="border-border bg-background space-y-4 rounded-lg border p-4"
      role="group"
      aria-label="Potwierdź nową planszę"
    >
      <p className="text-foreground text-sm">
        Zostanie utworzona nowa plansza z nowym kodem. Gracze przejdą do nowej sesji (dołączą automatycznie lub wpiszą
        nowy kod).
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={navigating}
          onClick={() => {
            if (!navigating) setConfirmOpen(false);
          }}
        >
          Anuluj
        </Button>
        <Button type="button" disabled={navigating} onClick={handleConfirm}>
          {navigating ? (
            <span className="flex items-center gap-2">
              <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
              Przechodzenie…
            </span>
          ) : (
            "Kontynuuj"
          )}
        </Button>
      </div>
    </div>
  );
}
