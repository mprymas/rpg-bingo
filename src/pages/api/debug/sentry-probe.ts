import type { APIRoute } from "astro";
import { reportError } from "@/lib/report-error";

export const prerender = false;

/** Dev-only probe: exercises reportError → Sentry. Unreachable in production builds. */
export const GET: APIRoute = () => {
  if (import.meta.env.PROD) {
    return new Response(null, { status: 404 });
  }

  reportError(new Error("Sentry probe: deliberate test error"), {
    route: "GET /api/debug/sentry-probe",
  });

  return new Response(JSON.stringify({ ok: true, probed: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
