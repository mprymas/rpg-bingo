import * as Sentry from "@sentry/astro";

const dsn = typeof import.meta.env.PUBLIC_SENTRY_DSN === "string" ? import.meta.env.PUBLIC_SENTRY_DSN : undefined;

Sentry.init({
  dsn,
  tracesSampleRate: 0.1,
  integrations: [Sentry.browserTracingIntegration()],
});
