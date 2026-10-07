import { defineMiddleware } from "astro:middleware";
import { reportError } from "@/lib/report-error";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/sessions"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      reportError(error, { route: context.url.pathname });
    }
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
