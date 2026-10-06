# Repository Guidelines

RPG Bingo is an Astro 7 SSR app (React 19 islands, Tailwind 4, Supabase auth) on Cloudflare Workers. Treat @CLAUDE.md as the deeper source of truth for architecture and conventions.

## Hard rules

- Full SSR (`output: "server"` in @astro.config.mjs). API handlers export uppercase `GET`/`POST` only. Never add Next.js `"use client"` directives.
- Merge Tailwind classes with `cn()` from `@/lib/utils` — do not concatenate class strings.
- Secrets: `SUPABASE_URL` and `SUPABASE_KEY` from @.env.example into `.env` (Node) or `.dev.vars` (Cloudflare local). Never commit either file.
- New DB tables: SQL under `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`, with RLS on and per-operation, per-role policies (@CLAUDE.md).
- Prefer Astro for static UI; React only when interactivity is required. Put shared types in `src/types.ts`, helpers in `src/lib/` (or `src/lib/services/`), hooks in `src/components/hooks/`.
- **UI**: tokens in @src/styles/global.css (`:root`/`.dark` → `@theme inline`); components in @src/components/ui — check there before inventing primitives (`npx shadcn@latest add [name]`). No literal colours / palette classes / arbitrary values in views (`npm run lint` runs @scripts/check-ui-literals.mjs). Dark-only. Kitchen sinks (dev): `/sessions/new/kitchen-sink`, `/dashboard/kitchen-sink`, `/sessions/board/kitchen-sink`, `/auth/signin/kitchen-sink`, `/auth/signup/kitchen-sink`, `/auth/confirm-email/kitchen-sink`. Details: @CLAUDE.md § UI / design tokens.

## Project structure

Layout and scripts overview: @README.md. Alias `@/*` → `./src/*` (@tsconfig.json). Deploy/runtime: @wrangler.jsonc; UI kit: @components.json (new-york). `src/middleware.ts` attaches `locals.user` and guards `PROTECTED_ROUTES`.

## Build, test, and development

Scripts: @package.json. For `npm run smoke`, set `BASE_URL` (default `http://localhost:4321`) against a running server. Pre-commit: husky + lint-staged (@package.json). Node via @.nvmrc.

## Coding style

Formatting: @.prettierrc.json. Typecheck paths: @tsconfig.json. Install new shadcn pieces with `npx shadcn@latest add [name]` (@components.json, new-york).

## Testing

Vitest: `npm run test:unit` (pure modules under `src/**/*.test.ts`) and `npm run test:integration` (preview HTTP tests under `tests/integration/`, needs `PREVIEW_BASE_URL`/`BASE_URL` + smoke/test credentials). Auth-flow smoke: `npm run smoke` (@scripts/smoke.mjs) against a running server. CI `ci` job runs unit; `smoke` job runs smoke then integration against local Supabase + preview. Cookbook: @context/foundation/test-plan.md §6. No Playwright e2e yet (test-plan Phase 2). Re-run smoke after dependency upgrades.

## Commits and pull requests

History is short and imperative (e.g. `bootstrap`). PRs to `master` must pass @.github/workflows/ci.yml (repo secrets `SUPABASE_URL` / `SUPABASE_KEY` for the build job).
