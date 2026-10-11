import { useState } from "react";
import type { ApiErrorResponse } from "@/types";

export function useDeleteSession() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteSession(sessionId: string): Promise<boolean> {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        window.location.assign("/dashboard");
        return true;
      }

      let message = "Nie udało się usunąć sesji";
      try {
        const data = (await response.json()) as ApiErrorResponse;
        if (data.error) message = data.error;
      } catch {
        // keep default message
      }
      setError(message);
      setPending(false);
      return false;
    } catch {
      setError("Nie udało się usunąć sesji");
      setPending(false);
      return false;
    }
  }

  return { pending, error, setError, deleteSession };
}
