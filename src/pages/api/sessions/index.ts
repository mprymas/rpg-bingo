import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { createSessionSchema } from "@/lib/schemas/session";
import { BoardGenerationError } from "@/lib/services/board-generator";
import {
  CloseSessionAsReplacedError,
  closeSessionAsReplaced,
  createSession,
  SessionServiceError,
} from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";
import type { CreateSessionResponse } from "@/types";

export const prerender = false;

function boardGenerationMessage(error: BoardGenerationError, size: number): string {
  switch (error.code) {
    case "TOO_MANY_GUARANTEED":
      return "Zbyt wiele haseł gwarantowanych";
    case "POOL_TOO_SMALL":
      return `Za mało haseł na planszę ${size}×${size} — dodaj jeszcze ${error.missing ?? 0} własnych haseł`;
    case "TOO_MANY_REWARDS":
      return "Zbyt wiele nagród";
  }
}

function closeErrorMessage(error: CloseSessionAsReplacedError): string {
  switch (error.code) {
    case "SESSION_NOT_FOUND":
      return "Nie udało się zamknąć poprzedniej sesji — nie znaleziono sesji źródłowej";
    case "SESSION_NOT_ACTIVE":
      return "Nie udało się zamknąć poprzedniej sesji — jest już zamknięta";
    case "REPLACEMENT_NOT_FOUND":
      return "Nie udało się zamknąć poprzedniej sesji — brak sesji zastępczej";
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json({ error: "Wymagane logowanie" }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Nieprawidłowy format żądania" }, 400);
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return json({ error: firstIssue.message }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Nie udało się utworzyć sesji" }, 500);
  }

  try {
    const result = await createSession(supabase, parsed.data);
    const response: CreateSessionResponse = { id: result.id, code: result.code };

    if (parsed.data.replaceSessionId) {
      try {
        await closeSessionAsReplaced(supabase, {
          sessionId: parsed.data.replaceSessionId,
          replacedBySessionId: result.id,
        });
      } catch (closeError) {
        if (closeError instanceof CloseSessionAsReplacedError) {
          response.closeError = closeErrorMessage(closeError);
        } else {
          reportError(closeError, {
            route: "POST /api/sessions (close after create)",
            httpStatus: 201,
            sessionId: parsed.data.replaceSessionId,
            replacedBySessionId: result.id,
          });
          response.closeError = "Nie udało się zamknąć poprzedniej sesji";
        }
      }
    }

    return json(response, 201);
  } catch (error) {
    if (error instanceof BoardGenerationError) {
      return json({ error: boardGenerationMessage(error, parsed.data.size) }, 400);
    }
    if (error instanceof SessionServiceError && error.code === "UNKNOWN_REWARD") {
      return json({ error: "Nieznana nagroda" }, 400);
    }
    reportError(error, { route: "POST /api/sessions", httpStatus: 500 });
    return json({ error: "Nie udało się utworzyć sesji" }, 500);
  }
};
