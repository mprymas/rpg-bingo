import type { APIRoute } from "astro";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { sessionUndoClaimBodySchema } from "@/lib/schemas/session-undo-claim";
import { UndoBoardCellError, undoBoardCell } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";
import type { UndoClaimSuccessResponse } from "@/types";

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

  const parsed = sessionUndoClaimBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return json({ error: firstIssue.message }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Brak konfiguracji" }, 500);
  }

  try {
    const result = await undoBoardCell(supabase, {
      sessionId: id,
      position: parsed.data.position,
    });

    const success: UndoClaimSuccessResponse = { cell: result.cell };
    return json(success, 200);
  } catch (error) {
    if (error instanceof UndoBoardCellError) {
      switch (error.code) {
        case "SESSION_NOT_FOUND":
          return json({ error: "Nie znaleziono sesji" }, 404);
        case "INVALID_POSITION":
        case "CELL_NOT_FOUND":
          return json({ error: "Nieprawidłowa pozycja" }, 400);
      }
    }
    return json({ error: "Nie udało się cofnąć oznaczenia" }, 500);
  }
};
