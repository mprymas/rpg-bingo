import { useState } from "react";
import type { CreateSessionCommand, CreateSessionResponse, ApiErrorResponse } from "@/types";

export function useCreateSession() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createSession(body: CreateSessionCommand) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 201) {
        const data = (await response.json()) as CreateSessionResponse;
        window.location.assign(`/sessions/${data.id}`);
        return;
      }

      let message = "Nie udało się utworzyć sesji";
      try {
        const data = (await response.json()) as ApiErrorResponse;
        if (data.error) message = data.error;
      } catch {
        // keep default message
      }
      setError(message);
    } catch {
      setError("Nie udało się utworzyć sesji");
    } finally {
      setPending(false);
    }
  }

  return { pending, error, createSession };
}
