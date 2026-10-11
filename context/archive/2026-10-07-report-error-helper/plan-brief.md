# Shared reportError helper — Plan Brief

> Full plan: `context/changes/report-error-helper/plan.md`
> Research: `context/changes/report-error-helper/research.md`

## What & Why

Add a shared server `reportError` that emits one structured `console.error` object so Cloudflare Workers Logs get stacks and codes when API/SSR handlers soft-catch failures. Soft UX stays; no vendor tracker yet. Closes the audit’s first fix: catch → soft response currently leaves responders with status only.

## Starting Point

No app-level reporter under `src/`. Eleven API and three SSR catches soft-return without logging; middleware and auth soft-map Auth `{ error }` the same way. Platform `observability.enabled` is already on in `wrangler.jsonc`.

## Desired End State

Unexpected soft failures (generic 500, empty 500/503, silent join redirect, Auth infra/`getUser`/`signOut` errors) leave a filterable `event: "server.error"` record with `route`, `code`, and `supabaseCode`. Mapped domain 4xx and bad-JSON 400s stay quiet. Soft redirects and Polish bodies unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Complexity | LOW | Single helper + additive call sites; no schema/UI | Plan |
| Log filter | Unexpected / fallback only | Cuts Workers Free noise; still covers audit blind spots | Plan |
| Wire breadth | All API/SSR catches that hit the filter | One PR closes handler-side P1 | Plan |
| Middleware/auth | Log `{ error }` in-scope; no UX fail-closed | Logging without A1/A2 behavior change | Plan |
| Mapper `Error.cause` | Out of scope | Separate audit J6; helper logs whatever is present | Plan |
| Transport | Structured `console.error` → Workers Logs | No Sentry; platform already collecting | Research |

## Scope

**In scope:** `src/lib/report-error.ts` + unit tests; wire unexpected API/SSR catches; middleware `getUser` error logging; auth signin/signup/signout `{ error }` logging per filter.

**Out of scope:** Sentry; client islands; fail-closed auth UX; mapper `cause`; PII in logs; lib soft-parse helpers; kitchen sinks; changing response mapping/copy.

## Architecture / Approach

Call sites keep soft returns. Before an unexpected soft return (or on Auth `{ error }` that passes the filter), call `reportError`, which builds `{ event: "server.error", route, code, supabaseCode, cause, name, message, stack, … }` and emits via `console.error` for Workers Logs field filters.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Helper + unit tests | `report-error.ts` + Vitest spy coverage | Extraction edge cases (non-Error, duck `code`) |
| 2. Wire API + SSR | Unexpected catches bound and logged | Accidentally logging mapped 4xx |
| 3. Middleware + auth | Auth outage visible in logs without UX change | Credential vs infra heuristic miss |

**Prerequisites:** Existing research + observability audit; local/dev Workers logs readable (`astro dev` console or `wrangler tail`).
**Estimated effort:** ~1 short session across 3 phases.

## Open Risks & Assumptions

- Auth `status` 400/401 skip may miss some infra-shaped 401s until A2 branching.
- Session `code` may appear in logs (prior practice); nicks/emails must not.

## Success Criteria (Summary)

- Unexpected soft failures produce structured `server.error` in Workers Logs
- Mapped domain 4xx remain silent
- Soft UX and HTTP contracts unchanged; unit tests cover the helper
