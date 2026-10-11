import type { APIRoute } from "astro";
import { PLAYER_COOKIE_NAME, readPlayerIdentity } from "@/lib/player-cookie";
import { reportError } from "@/lib/report-error";
import { playJoinCodeSchema } from "@/lib/schemas/play-join";
import { getActiveBoardByCode, getPlayerRewardProgress } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";
import type { PlayerBoard } from "@/types";

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

  const code = codeParsed.data;

  try {
    const board = await getActiveBoardByCode(supabase, code);
    if (!board) {
      return json({ error: "Nie znaleziono sesji" }, 404);
    }

    const identity = readPlayerIdentity(context.cookies.get(PLAYER_COOKIE_NAME)?.value, code);
    let progress: PlayerBoard["progress"] = null;
    if (identity) {
      try {
        progress = await getPlayerRewardProgress(supabase, code, identity.claimToken);
      } catch (progressError) {
        reportError(progressError, {
          route: "GET /api/play/board (progress)",
          httpStatus: 200,
          sessionCode: code,
        });
        progress = null;
      }
    }

    const body: PlayerBoard = { ...board, progress };
    return json(body, 200);
  } catch (error) {
    reportError(error, {
      route: "GET /api/play/board",
      httpStatus: 500,
      sessionCode: code,
    });
    return json({ error: "Nie udało się wczytać planszy" }, 500);
  }
};
