import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { DeleteSessionError, deleteSession } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";
import type { DeleteSessionSuccessResponse } from "@/types";

export const prerender = false;

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const DELETE: APIRoute = async (context) => {
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

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Brak konfiguracji" }, 500);
  }

  try {
    const result = await deleteSession(supabase, { sessionId: id });

    const success: DeleteSessionSuccessResponse = result;
    return json(success, 200);
  } catch (error) {
    if (error instanceof DeleteSessionError) {
      return json({ error: "Nie znaleziono sesji" }, 404);
    }
    reportError(error, {
      route: "DELETE /api/sessions/[id]",
      httpStatus: 500,
      sessionId: id,
    });
    return json({ error: "Nie udało się usunąć sesji" }, 500);
  }
};
