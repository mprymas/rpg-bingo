// @ts-check
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
    sentry({ enabled: { client: true, server: false } }),
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
