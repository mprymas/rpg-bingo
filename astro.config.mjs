// @ts-check
import process from "node:process";
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import sentry from "@sentry/astro";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [
    react(),
    sitemap(),
    // Client SDK only; server init is owned by sentry.server.config.ts (Worker withSentry wrap).
    // Source-map upload runs on production builds when SENTRY_AUTH_TOKEN is set; release from SENTRY_RELEASE.
    sentry({
      enabled: { client: true, server: false },
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      // Astro's typed options omit build-time `release`; pass name so uploaded maps match CI github.sha.
      ...(process.env.SENTRY_RELEASE
        ? {
            unstable_sentryVitePluginOptions: {
              release: { name: process.env.SENTRY_RELEASE },
            },
          }
        : {}),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  // Opt out of Astro Sessions so the Cloudflare adapter does not provision a KV "SESSION" namespace.
  session: false,
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      SENTRY_DSN: envField.string({ context: "server", access: "secret", optional: true }),
      SENTRY_ENVIRONMENT: envField.string({ context: "server", access: "secret", optional: true }),
      SENTRY_RELEASE: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
