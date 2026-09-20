# Repository Guidelines

RPG Bingo is an Astro 7 SSR app (React 19 islands, Tailwind 4, Supabase auth) on Cloudflare Workers. Treat @CLAUDE.md as the deeper source of truth for architecture and conventions.

## Hard rules

- Full SSR (`output: "server"` in @astro.config.mjs). API handlers export uppercase `GET`/`POST` only. Never add Next.js `"use client"` directives.
- Merge Tailwind classes with `cn()` from `@/lib/utils` — do not concatenate class strings.
- Secrets: `SUPABASE_URL` and `SUPABASE_KEY` from @.env.example into `.env` (Node) or `.dev.vars` (Cloudflare local). Never commit either file.
- New DB tables: SQL under `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`, with RLS on and per-operation, per-role policies (@CLAUDE.md).
- Prefer Astro for static UI; React only when interactivity is required. Put shared types in `src/types.ts`, helpers in `src/lib/` (or `src/lib/services/`), hooks in `src/components/hooks/`.

## Project structure

Layout and scripts overview: @README.md. Alias `@/*` → `./src/*` (@tsconfig.json). Deploy/runtime: @wrangler.jsonc; UI kit: @components.json (new-york). `src/middleware.ts` attaches `locals.user` and guards `PROTECTED_ROUTES`.

## Build, test, and development

Scripts: @package.json. For `npm run smoke`, set `BASE_URL` (default `http://localhost:4321`) against a running server. Pre-commit: husky + lint-staged (@package.json). Node via @.nvmrc.

## Coding style

Formatting: @.prettierrc.json. Typecheck paths: @tsconfig.json. Install new shadcn pieces with `npx shadcn@latest add [name]` (@components.json, new-york).

## Testing

No unit/e2e runner in-repo. Gate verification with `npm run smoke` (@scripts/smoke.mjs) against preview after a build; CI does the same with a local Supabase. Re-run smoke after dependency upgrades.

## Commits and pull requests

History is short and imperative (e.g. `bootstrap`). PRs to `master` must pass @.github/workflows/ci.yml (repo secrets `SUPABASE_URL` / `SUPABASE_KEY` for the build job).
