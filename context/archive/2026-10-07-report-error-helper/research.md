---
date: 2026-10-07T17:21:49+02:00
researcher: Marcin
git_commit: f26da855df57c2d9e910ebffade7c8c0f357a068
branch: master
repository: rpg-bingo
topic: "Shared server reportError helper for API/SSR Worker logs"
tags: [research, codebase, observability, reportError, cloudflare-workers, api, ssr]
status: complete
last_updated: 2026-10-07
last_updated_by: Marcin
---

# Research: Shared server reportError helper

**Date**: 2026-10-07T17:21:49+02:00
**Researcher**: Marcin
**Git Commit**: f26da855df57c2d9e910ebffade7c8c0f357a068
**Branch**: master
**Repository**: rpg-bingo

## Research Question

What should a shared server `reportError` helper look like, and where does it plug into this Astro SSR + Cloudflare Workers app so API/SSR soft catches leave stacks and codes in Workers logs (without adopting a vendor tracker yet)?

## Summary

There is **no** app-level reporter today: under the inspected `src/` tree at this commit, greps find **zero** `console.*` / `reportError` / Sentry usage. Platform collection is already on via `wrangler.jsonc` `observability.enabled: true`. On the **11** API and **3** SSR catch sites listed below, failures become **catch → soft Response** (JSON 4xx/5xx, redirect, or SSR 503 HTML) with no log, so Astro’s uncaught `console.error(stack)` path does not run for those handlers and Workers Logs see status/invocation metadata without diagnostic fields.

A first helper should be a **server-only** function that emits **one structured object** through `console.error({...})` (Workers Logs indexes object fields; string-only messages are text-searchable only), called from API/SSR catches **before** the existing soft return. Minimum context settled by the 2026-10-07 observability audit: `{ route, code, supabaseCode, cause }` plus privacy: log ids/codes, not emails/nicks/passwords. Module path, whether to log expected domain 4xx vs unexpected only, and middleware/auth soft-fail (no `try/catch` today) remain plan choices.

## Detailed Findings

### Current logging surface

- Grep of `console.(error|warn|log|info|debug)`, `reportError`, and Sentry/capture under `src/` at this commit: **no matches**.
- `wrangler.jsonc:12–14` sets `observability.enabled: true` with no `head_sampling_rate` in-repo (Workers Logs default sampling applies at the platform).
- `package.json` has no `@sentry/*` or structured logger dependency (same audit conclusion).
- `context/foundation/infrastructure.md:90` documents reading logs via `wrangler tail` and Workers Logs (Free: 200k events/day, **3-day** retention — `:81`, `:105`).
- Uncaught throws in Astro’s SSR handler still become an HTTP **500 Response** after a string `console.error` in the framework logger (`node_modules/astro/dist/core/routing/handler.js` ~101–108) — not a Worker `outcome=exception`. App soft-catches prevent that path on the inspected handlers below.

### Server catch sites (helper call targets)

Exact `\bcatch\b` matches under `src/pages/api/` on this tree: **11** sites.

| Anchor | Soft response shape | Bound error? |
|--------|---------------------|--------------|
| `src/pages/api/sessions/index.ts:31` | JSON 400 bad body | no |
| `src/pages/api/sessions/index.ts:61` | Domain → 400; else JSON 500 generic; `error` unused on 500 | yes |
| `src/pages/api/play/claim.ts:26` | JSON 400 bad body | no |
| `src/pages/api/play/claim.ts:66` | Domain → 4xx JSON; else JSON 500 | yes |
| `src/pages/api/play/join.ts:28` | redirect `/play` (formData) | no |
| `src/pages/api/play/join.ts:48` | redirect `/play/${code}` (board lookup) | no |
| `src/pages/api/play/join.ts:67` | Domain → `?error=`; else redirect `?join=1` without `error=` | yes |
| `src/pages/api/play/board.ts:32` | JSON 500 | no |
| `src/pages/api/sessions/[id]/board.ts:37` | JSON 500 | no |
| `src/pages/api/sessions/[id]/undo-claim.ts:36` | JSON 400 bad body | no |
| `src/pages/api/sessions/[id]/undo-claim.ts:59` | Domain → 4xx; else JSON 500 | yes |

Exact `\bcatch\b` under `src/pages/**/*.astro` on this tree: **3** empty catches → Polish message + `Astro.response.status = 503` (kitchen-sink pages under `src/pages/` have **0** `catch` matches):

- `src/pages/dashboard/index.astro:22`
- `src/pages/sessions/[id].astro:36`
- `src/pages/play/[code].astro:49`

Highest diagnostic value on this inspected set: bound service fallbacks at `sessions/index.ts:61`, `claim.ts:66`, `join.ts:67`, `undo-claim.ts:59`, and empty 500/503 catches that currently discard the thrown value (`play/board.ts:32`, `sessions/[id]/board.ts:37`, three SSR pages, `join.ts:48`).

Lib soft-parse (same swallow pattern; **not** HTTP handlers — plan may exclude or sample): `src/lib/player-cookie.ts:75`, `src/lib/request-origin.ts:12`, `:25`.

### Middleware and auth (adjacent, not catch-based)

- `src/middleware.ts:9–16` has **no** `try/catch`. When `createClient` is non-null it awaits `getUser()` and assigns `user ?? null` without reading `{ error }`. Auth/API failure and anonymous both become `user = null`, then protected routes redirect to sign-in (`:18–21`). A `reportError` helper alone does not fix this unless callers start checking `{ error }` and invoke it.
- Auth API routes `src/pages/api/auth/{signin,signup,signout}.ts` soft-map Supabase `{ error }` without `try/catch` (out of the catch-site list; still candidates for logging on `{ error }` branches).

### Domain errors available to the helper

Inspected classes under `src/lib/services/`:

| Class | Fields | Anchor |
|-------|--------|--------|
| `BoardGenerationError` | `code`, optional `missing` | `board-generator.ts:5–16` |
| `SessionServiceError` | `code` (`UNKNOWN_REWARD` \| `CODE_COLLISION`) | `sessions.service.ts:26–33` |
| `ClaimBoardCellError` | `code` only | `sessions.service.ts:38–45` |
| `JoinSessionPlayerError` | `code` only | `sessions.service.ts:240–247` |
| `UndoBoardCellError` | `code` only (same file, later) | `sessions.service.ts:344` area |

Mapped RPC failures (`joinErrorFromMessage` / `claimErrorFromMessage` at `sessions.service.ts:250–255`, `:292–297`) throw a **new** domain `Error` with **no** `Error.cause` and drop PostgREST `code`/`details`/`hint`. Unmapped RPC/`throw error` still carries PostgREST fields until the API catch replaces them with a generic body — that is the window where `reportError` can still read `supabaseCode`.

Grepped `cause:` under `src/`: **0** matches at this commit.

### Recommended emit shape (grounded)

Workers Logs indexes fields on structured `console.*` objects. Prefer one object (not string concatenation):

```ts
console.error({
  event: "server.error",
  route,           // e.g. "POST /api/play/claim" or pathname
  code,            // domain Error.code when present
  supabaseCode,    // PostgrestError.code / AuthApiError.code when present
  cause,           // serialize cause chain if/when introduced
  name,
  message,
  stack,
  // optional scalars from the call site only:
  sessionId?, sessionCode?, position?, httpStatus?,
});
```

**Do not pass:** password, email, nick, `claimToken`, raw FormData/body, cookie payload. Audit privacy rule: ids/codes only (`context/audits/observability/2026-10-07_auth-create-session-join-claim.md:119`). Session `code` is already treated as a table secret that appears in URLs/logs (`context/archive/2026-10-03-player-join-shared-board/plan-brief.md:75`) — logging it matches prior practice; nicks do not.

### Existing lib layout for placement

`src/lib/` holds services, schemas, `supabase.ts`, `player-cookie.ts`, `utils.ts` (`cn` only). There is **no** logging module yet. A new helper file under `src/lib/` (e.g. `report-error.ts`) matches AGENTS/CLAUDE “helpers in `src/lib/`” without inventing a second logging stack.

### Client islands (out of this change’s stated scope)

Client `\bcatch` / `.catch` under `src/components/` (SignInForm, GmBoard, PlayerBoard, useCreateSession) do not hit Workers Logs. Audit fix #5 defers client `console.error` / SDK to a later step (`2026-10-07_auth-create-session-join-claim.md:123`). This change’s title and notes target **API/SSR Worker logs** only (`change.md:3`, `:12`).

## Code References

- `wrangler.jsonc:12–14` — Workers observability flag
- `src/middleware.ts:9–21` — soft identity without error check
- `src/pages/api/sessions/index.ts:61–82` — bound `error` unused on generic 500
- `src/pages/api/play/join.ts:48–49`, `:67–76` — infra and unknown join → soft redirect
- `src/pages/api/play/claim.ts:66–78` — domain map vs generic 500
- `src/lib/services/sessions.service.ts:250–274` — join map drops PostgREST identity
- `src/lib/utils.ts` — no error helper today
- `node_modules/astro/dist/core/routing/handler.js` ~101–108 — uncaught → string log + 500 Response

## Architecture Insights

1. **Soft-response is the product pattern** — Polish JSON/redirect/503 HTML stays; logging is additive before return, not a switch to rethrow-by-default (audit C1 allows “rethrow **or** structured console.error” as alternatives — `:89`).
2. **Structured object > string** for Workers Logs field filters; Astro’s own uncaught path is string-only and rare under current catches.
3. **Domain `code` ≠ PostgREST `code`** — keep both fields (`code` / `supabaseCode`) as the audit minimum names them.
4. **Preserving diagnosis long-term** may need `Error(..., { cause })` in mappers (audit J6) — complementary to the helper, not required for a first reporter that logs whatever is still on the thrown value at the catch site.
5. **No vendor yet** — console → Workers Logs is the settled transport; Sentry is explicitly “optional later” (audit `:124`).

## Historical Context (from prior changes)

| Claim | Verdict | Notes |
|-------|---------|-------|
| Shared server `reportError(error, context)` with structured `console.error` and min `{ route, code, supabaseCode, cause }`, privacy ids/codes | **Supported** | `context/audits/observability/2026-10-07_auth-create-session-join-claim.md:119` |
| Call from every API/SSR catch before soft response | **Supported** as intended scope | same `:112`, `:119` |
| Sentry now | **Contradicted** as current requirement | `:124` optional later; roadmap baseline “partial” observability `context/foundation/roadmap.md:82` |
| PRD requires app error tracker | **Unsupported** | no logging NFR in `context/foundation/prd.md` (inspected via prior research) |
| SSR hard failures should use non-2xx | **Supported** (orthogonal) | `context/foundation/lessons.md:12–17` — status already 503 on the three SSR catches above |
| Session code may appear in server logs | **Supported** | archive player-join brief `:75` |
| `report-error-helper` plan already exists | **Contradicted** | only `change.md` stub; this `research.md` is first artifact |

## Related Research

- Primary prior artifact: `context/audits/observability/2026-10-07_auth-create-session-join-claim.md` (audit, not a `research.md`).
- No other `context/changes/**/research.md` or archive research specifically about `reportError` found in this pass.

## Open Questions

These are **plan** decisions, not blocking research gaps:

1. **Log expected domain 4xx** (e.g. `SESSION_FULL`, `POOL_TOO_SMALL`) or **unexpected / fallback / empty-catch only**? Affects noise vs completeness on Workers Free quotas.
2. **Exact TypeScript signature** — `context: { route: string; code?: string; supabaseCode?: string; cause?: unknown; … }` vs extracting `code`/`supabaseCode` inside the helper via `instanceof` / duck-typing.
3. **Wire all 11 API + 3 SSR catches in one PR** vs helper-first + highest-value sites (create-session, join, claim, SSR loads).
4. **Middleware / auth `{ error }` logging** in this change or a follow-up (A1/A2 in the audit).
5. **Whether mappers should attach `cause`** in the same change or separately (J6).
6. **Unit test strategy** — spy on `console.error` in Vitest for the pure helper (`npm run test:unit` pattern).

## Inspected scope

- Greps: `catch`, `console.*`, `reportError`, `cause:` under `src/`
- Reads: middleware, sessions create API, join API, claim catch, domain error classes / mappers, `wrangler.jsonc`, `change.md`, observability audit, infrastructure/roadmap/lessons hits, `src/lib/` file list
- Workers: catch inventory, prior decisions, Workers/Astro log constraints
- **Not run:** `wrangler tail`, fake ingest, production dashboard alert verification
)