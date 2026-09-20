# Rules for AI

This file provides guidance to AI Agent when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npm run smoke` — dependency-free auth-flow smoke test (`scripts/smoke.mjs`) against a running server, `BASE_URL` env (default `http://localhost:4321`). Run after dependency upgrades; CI runs it against the production preview with a local Supabase.

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 7 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored). Do not add `wrangler dev` to scripts — `astro dev`/`astro preview` already run inside workerd via the adapter.

## Deployment (Cloudflare Workers)

- Worker name: `rpg-bingo` (`wrangler.jsonc`). Do not rename — a rename creates a new Worker and loses version history.
- `session: false` in `astro.config.mjs` keeps the adapter from provisioning a KV `SESSION` namespace. Keep `compatibility_date` and `nodejs_compat` as-is; bump the date only as a dedicated PR with `npm run build` + `npm run smoke`.
- Production path: push to `master` → CI `deploy` job runs `wrangler deploy`. Manual fallback: `npm run build && npx wrangler deploy --message "…"`.
- Safe without approval: `npx wrangler deploy --dry-run --outdir <tmp>`, `npx wrangler check startup`, `npx wrangler versions list`, `npx wrangler deployments status`, `npx wrangler tail --format pretty`.
- Needs human approval: `wrangler deploy`, `wrangler secret put/bulk/delete` (each immediately publishes a new version), `wrangler rollback`, anything touching the production Supabase schema.
- Secrets: `SUPABASE_URL`, `SUPABASE_KEY` in Workers Secrets (`npx wrangler secret bulk .env` from a clean `master`). Rollback (`npx wrangler rollback`) reverts code only, not secrets or Supabase migrations — keep migrations backward-compatible by one version.
- Details and risk register: `context/foundation/infrastructure.md`; first-deploy record: `context/deployment/deploy-plan.md`.

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`), on every push and PR to master: `ci` (lint, `astro check`, build; needs `SUPABASE_URL`/`SUPABASE_KEY` repo secrets) and `smoke` (local Supabase + production preview + `npm run smoke`). On `push` to `master` only, `deploy` runs after both (`cloudflare/wrangler-action@v4`; needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets). Workers Builds git integration must stay off for this repo.
