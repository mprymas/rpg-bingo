import * as Sentry from "@sentry/cloudflare";
import handler from "@astrojs/cloudflare/entrypoints/server";

/** Worker env keys used for Sentry init (also set via .dev.vars / Workers Secrets). */
interface SentryWorkerEnv {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_RELEASE?: string;
}

export default Sentry.withSentry((env) => {
  const { SENTRY_DSN, SENTRY_ENVIRONMENT, SENTRY_RELEASE } = env as SentryWorkerEnv;

  return {
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    ...(SENTRY_ENVIRONMENT ? { environment: SENTRY_ENVIRONMENT } : {}),
    ...(SENTRY_RELEASE ? { release: SENTRY_RELEASE } : {}),
  };
}, handler);
