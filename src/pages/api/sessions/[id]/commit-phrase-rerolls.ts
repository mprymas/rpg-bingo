import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { commitPhraseRerollsBodySchema } from "@/lib/schemas/commit-phrase-rerolls";
import { commitPhraseRerolls, PhraseRerollError } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";
import type { CommitPhraseRerollsSuccessResponse } from "@/types";

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

  const parsed = commitPhraseRerollsBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return json({ error: firstIssue.message }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Brak konfiguracji" }, 500);
  }

  try {
    const result = await commitPhraseRerolls(supabase, {
      sessionId: id,
      changes: parsed.data.changes,
    });

    const success: CommitPhraseRerollsSuccessResponse = { cells: result.cells };
    return json(success, 200);
  } catch (error) {
    if (error instanceof PhraseRerollError) {
      switch (error.code) {
        case "SESSION_NOT_FOUND":
          return json({ error: "Nie znaleziono sesji" }, 404);
        case "INVALID_POSITION":
        case "CELL_NOT_FOUND":
          return json({ error: "Nieprawidłowa pozycja" }, 400);
        case "PHRASE_NOT_IN_CATALOG":
          return json({ error: "Hasło nie pochodzi z katalogu" }, 400);
        case "POOL_EMPTY":
          return json({ error: "Brak innego hasła w katalogu" }, 409);
        case "DUPLICATE_PHRASE":
          return json({ error: "Hasło powtarza się na planszy" }, 409);
        case "CELL_CLAIMED":
          return json({ error: "Pole jest już zajęte", positions: error.positions ?? [] }, 409);
      }
    }
    reportError(error, {
      route: "POST /api/sessions/[id]/commit-phrase-rerolls",
      httpStatus: 500,
      sessionId: id,
    });
    return json({ error: "Nie udało się zatwierdzić haseł" }, 500);
  }
};
