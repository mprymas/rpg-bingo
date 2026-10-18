# Sources: code

- repo_root: c:\projects\php\rpg-bingo
- code_scope: . (whole repository; single application, not a monorepo)
- head: 3a311f2 (at inventory time the worktree was clean; this distillation later added untracked `context/domain/`)
- path_alias: none (`@/*` in tsconfig maps to `./src/*`; citations stay repository-relative)

## Stack

- TypeScript, Astro 7 SSR (`output: "server"`), React 19 islands
- Tailwind 4, zod for request schemas
- Supabase (Postgres + auth) via `@supabase/ssr` / `@supabase/supabase-js`; SQL migrations under `supabase/migrations/`
- Cloudflare Workers (`@astrojs/cloudflare`, `wrangler.jsonc`)
- Tests: Vitest (unit under `src/**/*.test.ts`, integration under `tests/integration/`), Playwright under `tests/e2e/`

## Layers

| layer | path patterns | notes |
| --- | --- | --- |
| entry points | `src/pages/api/**/*.ts`, `src/pages/**/*.astro`, `src/middleware.ts` | API handlers export uppercase `GET`/`POST`. Pages are server-rendered. Middleware runs on every request. |
| application logic | `src/lib/services/**/*.ts`, `src/lib/schemas/**/*.ts`, `src/lib/*.ts` (except `src/lib/utils.ts`) | Services and zod schemas. No use-case/command framework. |
| domain types | `src/types.ts`, `src/db/database.types.ts` | No separate domain package, entities folder, or aggregate types. Shared types live next to generated database types. |
| persistence | `supabase/migrations/*.sql`, `supabase/seed.sql`, `supabase/config.toml` | Schema, constraints, row policies, and SQL functions. No ORM models. |
| UI | `src/components/**/*.{tsx,astro}`, `src/pages/**/*.astro`, `src/layouts/**`, `src/styles/global.css` | Astro for static layout; React islands where interaction is needed. Copy is inline in components (no translation files). Dev-only kitchen-sink pages live under the same `src/pages/` tree. |
| tests | `src/**/*.test.ts`, `tests/integration/**/*.test.ts`, `tests/e2e/**/*.spec.ts`, `tests/helpers/**` | Unit tests sit beside the module they cover. |

A separate domain layer does not exist. Rules, if any, live in services, API handlers, SQL, or UI.

Source file count inside the code scope (tracked application code, SQL, and tests) is well under 1,500. Do not split the rules search.

## Excluded

| path | reason |
| --- | --- |
| `context/domain/` | This distillation and its evidence. Do not read it back as product evidence. |
| `context/archive/*-domain-distillation/` | None present. If created later, exclude. |
| `context/**` (other than the exclusion above) | Documents. Listed in `0-documents.md`. Code agents do not read them. |
| `CLAUDE.md`, `AGENTS.md`, `README.md` | Agent and human instruction files. Reference documents for the docs agent only. |
| `.cursor/**`, `.github/**`, `.husky/**`, `.vscode/**` | Agent, CI, and editor configuration. |
| `scripts/**`, `eslint.config.js`, `playwright.config.ts`, `vitest.config.ts`, `astro.config.mjs`, `wrangler.jsonc`, `components.json`, `tsconfig.json`, `package.json`, `package-lock.json` | Build, lint, and test tooling. |
| `node_modules/`, `dist/`, `.astro/` | Vendored and generated. Not in the git file list. |
| `public/**`, `sentry.client.config.ts`, `sentry.server.config.ts`, `src/lib/report-error.ts`, `src/lib/utils.ts`, `src/pages/api/debug/**` | Static assets, error reporting, and class-name helpers. Not product rules. |
