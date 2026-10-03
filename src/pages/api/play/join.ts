import type { APIRoute } from "astro";
import { PLAYER_COOKIE_NAME, writePlayerIdentity } from "@/lib/player-cookie";
import { playJoinCodeSchema, playJoinNickSchema } from "@/lib/schemas/play-join";
import { getActiveBoardByCode } from "@/lib/services/sessions.service";
import { createClient } from "@/lib/supabase";

export const prerender = false;

function isUrlEncodedForm(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;
  return contentType.split(";")[0].trim().toLowerCase() === "application/x-www-form-urlencoded";
}

export const POST: APIRoute = async (context) => {
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
  } catch {
    return context.redirect(`/play/${code}`);
  }

  const nickParsed = playJoinNickSchema.safeParse(form.get("nick"));
  if (!nickParsed.success) {
    return context.redirect(`/play/${code}?join=1&error=nick`);
  }

  const written = writePlayerIdentity(context.cookies.get(PLAYER_COOKIE_NAME)?.value, code, nickParsed.data);
  context.cookies.set(PLAYER_COOKIE_NAME, written.value, {
    httpOnly: written.httpOnly,
    sameSite: written.sameSite,
    path: written.path,
    maxAge: written.maxAge,
  });

  return context.redirect(`/play/${code}`);
};
