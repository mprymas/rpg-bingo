import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      reportError(error, { route: "POST /api/auth/signout" });
    }
  }
  return context.redirect("/");
};
