import type { APIRoute } from "astro";
import { PLAYER_COOKIE_NAME, readPlayerIdentity } from "@/lib/player-cookie";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { playClaimBodySchema } from "@/lib/schemas/play-claim";
import { ClaimBoardCellError, claimBoardCell } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";
import type { ClaimConflictResponse, ClaimSuccessResponse } from "@/types";

export const prerender = false;

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

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Nieprawidłowy format żądania" }, 400);
  }

  const parsed = playClaimBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return json({ error: firstIssue.message }, 400);
  }

  const { code, position } = parsed.data;
  const cookieValue = context.cookies.get(PLAYER_COOKIE_NAME)?.value;
  const identity = readPlayerIdentity(cookieValue, code);
  if (!identity) {
    return json({ error: "Dołącz do sesji, aby zajmować pola" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json({ error: "Brak konfiguracji" }, 500);
  }

  try {
    const result = await claimBoardCell(supabase, {
      code,
      playerId: identity.playerId,
      position,
    });

    if (result.status === "conflict") {
      const conflict: ClaimConflictResponse = {
        error: "conflict",
        occupant: result.occupant,
        cell: result.cell,
      };
      return json(conflict, 409);
    }

    const success: ClaimSuccessResponse = { cell: result.cell };
    return json(success, 200);
  } catch (error) {
    if (error instanceof ClaimBoardCellError) {
      switch (error.code) {
        case "SESSION_NOT_FOUND":
          return json({ error: "Nie znaleziono sesji" }, 404);
        case "PLAYER_NOT_FOUND":
          return json({ error: "Dołącz do sesji, aby zajmować pola" }, 401);
        case "INVALID_POSITION":
        case "CELL_NOT_FOUND":
          return json({ error: "Nieprawidłowa pozycja" }, 400);
      }
    }
    return json({ error: "Nie udało się zająć pola" }, 500);
  }
};
