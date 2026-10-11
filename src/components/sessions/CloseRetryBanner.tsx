import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Source session that failed to close. */
  sourceSessionId: string;
  /** Newly created session id (replacement). */
  replacedBySessionId: string;
  /** Kitchen-sink: no POST. */
  preview?: boolean;
  /** Kitchen-sink: seed visible banner. */
  initialVisible?: boolean;
}

export default function CloseRetryBanner({
  sourceSessionId,
  replacedBySessionId,
  preview = false,
  initialVisible = true,
}: Props) {
  const [visible, setVisible] = useState(initialVisible);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  async function retryClose() {
    if (pending) return;
    setPending(true);
    setError(null);

    if (preview) {
      setVisible(false);
      setPending(false);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sourceSessionId)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replacedBySessionId }),
      });
      if (!response.ok) {
        let message = "Nie udało się zamknąć poprzedniej sesji";
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // keep default
        }
        setError(message);
        setPending(false);
        return;
      }

      setVisible(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("closeFailed");
      url.searchParams.delete("sourceId");
      window.history.replaceState({}, "", url.pathname + url.search);
      setPending(false);
    } catch {
      setError("Nie udało się zamknąć poprzedniej sesji");
      setPending(false);
    }
  }

  return (
    <div className="border-border bg-background space-y-3 rounded-lg border p-4" role="alert">
      <p className="text-foreground text-sm">
        Nowa plansza jest gotowa, ale nie udało się zamknąć poprzedniej sesji. Spróbuj ponownie zamknąć starą sesję.
      </p>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={pending} onClick={() => void retryClose()}>
          {pending ? (
            <span className="flex items-center gap-2">
              <span className="border-foreground/30 border-t-foreground size-4 animate-spin rounded-full border-2" />
              Zamykanie…
            </span>
          ) : (
            "Zamknij poprzednią sesję"
          )}
        </Button>
      </div>
    </div>
  );
}
