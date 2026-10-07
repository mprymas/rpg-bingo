import type { APIRoute } from "astro";
import { PLAYER_COOKIE_NAME, readPlayerIdentity, writePlayerIdentity } from "@/lib/player-cookie";
import { reportError } from "@/lib/report-error";
import { isAllowedRequestOrigin } from "@/lib/request-origin";
import { playJoinCodeSchema, playJoinNickSchema } from "@/lib/schemas/play-join";
import { getActiveBoardByCode, JoinSessionPlayerError, joinSessionPlayer } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function isUrlEncodedForm(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;
  return contentType.split(";")[0].trim().toLowerCase() === "application/x-www-form-urlencoded";
}

export const POST: APIRoute = async (context) => {
  if (!isAllowedRequestOrigin(context.request)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!isUrlEncodedForm(context.request)) {
    return context.redirect("/play");
  }

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return context.redirect("/play");
  }

  const codeParsed = playJoinCodeSchema.safeParse(form.get("code"));
  if (!codeParsed.success) {
    return context.redirect("/play");
  }
  const code = codeParsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response("Brak konfiguracji", { status: 500 });
  }

  try {
    const board = await getActiveBoardByCode(supabase, code);
    if (!board) {
      return context.redirect(`/play/${code}`);
    }
  } catch (error) {
    reportError(error, { route: "POST /api/play/join", sessionCode: code });
    return context.redirect(`/play/${code}`);
  }

  const nickParsed = playJoinNickSchema.safeParse(form.get("nick"));
  if (!nickParsed.success) {
    return context.redirect(`/play/${code}?join=1&error=nick`);
  }

  const cookieValue = context.cookies.get(PLAYER_COOKIE_NAME)?.value;
  const existing = readPlayerIdentity(cookieValue, code);

  let joined;
  try {
    joined = await joinSessionPlayer(supabase, {
      code,
      nick: nickParsed.data,
      claimToken: existing?.claimToken ?? null,
    });
  } catch (error) {
    if (error instanceof JoinSessionPlayerError) {
      if (error.code === "SESSION_FULL") {
        return context.redirect(`/play/${code}?join=1&error=full`);
      }
      if (error.code === "INVALID_NICK") {
        return context.redirect(`/play/${code}?join=1&error=nick`);
      }
    }
    reportError(error, { route: "POST /api/play/join", sessionCode: code });
    return context.redirect(`/play/${code}?join=1`);
  }

  const written = writePlayerIdentity(
    cookieValue,
    code,
    {
      playerId: joined.playerId,
      claimToken: joined.claimToken,
      nick: joined.nick,
      color: joined.color,
    },
    { secure: import.meta.env.PROD },
  );
  context.cookies.set(PLAYER_COOKIE_NAME, written.value, {
    httpOnly: written.httpOnly,
    sameSite: written.sameSite,
    path: written.path,
    maxAge: written.maxAge,
    secure: written.secure,
  });

  return context.redirect(`/play/${code}`);
};
