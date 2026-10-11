import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { sessionCloseBodySchema } from "@/lib/schemas/session-close";
import { CloseSessionAsReplacedError, closeSessionAsReplaced } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";
import type { CloseSessionSuccessResponse } from "@/types";

export const prerender = false;

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  if (!isAllowedRequestOrigin(context.request)) {
    return json({ error: "Forbidden" }, 403);
  }

  if (!context.locals.user) {
    return json({ error: "Wymagane logowanie" }, 401);
  }

  const id = context.params.id ?? "";
  if (!SESSION_ID_PATTERN.test(id)) {
    return json({ error: "Nie znaleziono sesji" }, 404);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Nieprawidłowy format żądania" }, 400);
  }

  const parsed = sessionCloseBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return json({ error: firstIssue.message }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Brak konfiguracji" }, 500);
  }

  try {
    const result = await closeSessionAsReplaced(supabase, {
      sessionId: id,
      replacedBySessionId: parsed.data.replacedBySessionId,
    });

    const success: CloseSessionSuccessResponse = result;
    return json(success, 200);
  } catch (error) {
    if (error instanceof CloseSessionAsReplacedError) {
      switch (error.code) {
        case "SESSION_NOT_FOUND":
          return json({ error: "Nie znaleziono sesji" }, 404);
        case "SESSION_NOT_ACTIVE":
          return json({ error: "Sesja jest już zamknięta" }, 409);
        case "REPLACEMENT_NOT_FOUND":
          return json({ error: "Nie znaleziono sesji zastępczej" }, 400);
      }
    }
    reportError(error, {
      route: "POST /api/sessions/[id]/close",
      httpStatus: 500,
      sessionId: id,
      replacedBySessionId: parsed.data.replacedBySessionId,
    });
    return json({ error: "Nie udało się zamknąć sesji" }, 500);
  }
};
