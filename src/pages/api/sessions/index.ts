import type { APIRoute } from "astro";
import { createSessionSchema } from "@/lib/schemas/session";
import { BoardGenerationError } from "@/lib/services/board-generator";
import { createSession, SessionServiceError } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";

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

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "Wymagane logowanie" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Nieprawidłowy format żądania" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return new Response(JSON.stringify({ error: firstIssue.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Nie udało się utworzyć sesji" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await createSession(supabase, parsed.data);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof BoardGenerationError) {
      return new Response(
        JSON.stringify({
          error: boardGenerationMessage(error, parsed.data.size),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (error instanceof SessionServiceError && error.code === "UNKNOWN_REWARD") {
      return new Response(JSON.stringify({ error: "Nieznana nagroda" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Nie udało się utworzyć sesji" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
