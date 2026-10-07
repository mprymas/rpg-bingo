import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase";

/** Log Auth infra failures; skip credential-shaped 400/401. Never include credentials. */
function shouldReportAuthError(error: { status?: number }): boolean {
  const status = error.status;
  return status === undefined || status >= 500;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    reportError(new Error("Supabase nie jest skonfigurowany"), {
      route: "POST /api/auth/signup",
      httpStatus: 503,
    });
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase nie jest skonfigurowany")}`);
  }
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    if (shouldReportAuthError(error)) {
      reportError(error, {
        route: "POST /api/auth/signup",
        ...(error.status !== undefined ? { httpStatus: error.status } : {}),
      });
    }
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/auth/confirm-email");
};
