import type { APIRoute } from "astro";
import { getSessionWithCells } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async (context) => {
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
    const session = await getSessionWithCells(supabase, id, context.locals.user.id);
    if (!session) {
      return json({ error: "Nie znaleziono sesji" }, 404);
    }
    return json(session, 200);
  } catch {
    return json({ error: "Nie udało się wczytać planszy" }, 500);
  }
};
