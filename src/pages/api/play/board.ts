import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { playJoinCodeSchema } from "@/lib/schemas/play-join";
import { getActiveBoardByCode } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async (context) => {
  const codeParsed = playJoinCodeSchema.safeParse(context.url.searchParams.get("code") ?? "");
  if (!codeParsed.success) {
    return json({ error: "Nieprawidłowy kod sesji" }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Brak konfiguracji" }, 500);
  }

  try {
    const board = await getActiveBoardByCode(supabase, codeParsed.data);
    if (!board) {
      return json({ error: "Nie znaleziono sesji" }, 404);
    }
    return json(board, 200);
  } catch (error) {
    reportError(error, {
      route: "GET /api/play/board",
      httpStatus: 500,
      sessionCode: codeParsed.data,
    });
    return json({ error: "Nie udało się wczytać planszy" }, 500);
  }
};
