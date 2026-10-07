import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase";

function acceptsJson(request: Request): boolean {
  const header = request.headers.get("accept");
  if (!header) {
    return false;
  }
  return header.split(",").some((entry) => entry.split(";")[0].trim().toLowerCase() === "application/json");
}

function jsonResponse(body: { error: string } | { redirect: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Log Auth infra failures; skip credential-shaped 400/401. Never include credentials. */
function shouldReportAuthError(error: { status?: number }): boolean {
  const status = error.status;
  return status === undefined || status >= 500;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;
  const json = acceptsJson(context.request);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    reportError(new Error("Supabase nie jest skonfigurowany"), {
      route: "POST /api/auth/signin",
      httpStatus: 503,
    });
    const message = "Supabase nie jest skonfigurowany";
    if (json) {
      return jsonResponse({ error: message }, 503);
    }
    return context.redirect(`/auth/signin?error=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (shouldReportAuthError(error)) {
      reportError(error, {
        route: "POST /api/auth/signin",
        ...(error.status !== undefined ? { httpStatus: error.status } : {}),
      });
    }
    if (json) {
      return jsonResponse({ error: error.message }, 401);
    }
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  if (json) {
    return jsonResponse({ redirect: "/dashboard" }, 200);
  }

  return context.redirect("/dashboard");
};
