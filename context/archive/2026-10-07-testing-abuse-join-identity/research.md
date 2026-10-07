---
date: 2026-10-07T12:39:56+02:00
researcher: Marcin
git_commit: 07e8d90d3e933be9b50e53726c1b6af432ca4ea7
branch: master
repository: rpg-bingo
topic: "Abuse & join identity — where Risks #6/#8 live and how Phase 3 should test them"
tags: [research, codebase, authz, join-identity, route-guard, abuse, integration-tests]
status: complete
last_updated: 2026-10-07
last_updated_by: Marcin
last_updated_note: Initial Phase 3 research for test-plan risks #6 #8
---

# Research: Abuse & join identity test coverage

**Date**: 2026-10-07T12:39:56+02:00  
**Researcher**: Marcin  
**Git Commit**: `07e8d90d3e933be9b50e53726c1b6af432ca4ea7`  
**Branch**: master  
**Repository**: rpg-bingo

## Research Question

For change `testing-abuse-join-identity` (test-plan §3 Phase 3): where do Risks #6 and #8 live in the current codebase, and what is the cheapest API-authz / route-guard way to prove protection — without full e2e login theater or kitchen-sink-only coverage?

## Summary

On the inspected paths, Risk #6 splits into **player write identity** vs **code-as-read-capability**. Claims require an httpOnly `rpg_player` entry for the request `code` and a DB-valid `claim_token` for that session ([src/pages/api/play/claim.ts:37-41](src/pages/api/play/claim.ts), [supabase/migrations/20261003190000_player_claim_token.sql:154-162](supabase/migrations/20261003190000_player_claim_token.sql)). GM undo and GM board reads require Supabase auth plus `gm_id` ownership ([src/pages/api/sessions/[id]/undo-claim.ts](src/pages/api/sessions/[id]/undo-claim.ts), [src/lib/services/sessions.service.ts:173-174](src/lib/services/sessions.service.ts), [supabase/migrations/20261003200000_undo_board_cell.sql:24-32](supabase/migrations/20261003200000_undo_board_cell.sql)). Invalid/unknown codes get **404** on player board GET and play SSR — matching PRD “bez ważnego kodu nie widzi planszy” ([src/pages/api/play/board.ts:27-29](src/pages/api/play/board.ts), [context/foundation/prd.md:137](context/foundation/prd.md)). A **valid** (guessed/leaked) active code intentionally allows join + board poll without player proof ([src/pages/api/play/board.ts:15-31](src/pages/api/play/board.ts)); Phase 3 should not treat that as a bug — prove **forged/wrong-session claim** and **cross-owner GM APIs**, not “code alone must hide the board.”

Risk #8 on the inspected MG surfaces is already layered: middleware `PROTECTED_ROUTES = ["/dashboard", "/sessions"]` redirects anonymous page traffic to `/auth/signin` ([src/middleware.ts:4-21](src/middleware.ts)); MG APIs check `locals.user` and return **401** JSON ([src/pages/api/sessions/index.ts:21-25](src/pages/api/sessions/index.ts), [src/pages/api/sessions/[id]/board.ts:17-18](src/pages/api/sessions/[id]/board.ts)). Smoke covers anonymous dashboard/create-page redirects and anonymous create POST; the contract matrix covers anonymous GM board GET and undo POST. Phase 3 must extend beyond “status only on unknown ids” to **live-session** forged-cookie claim deny + board-unchanged, and systematic “no protected board content” on MG entry points — challenging “auth-flow smoke ⇒ every MG-protected route is closed.”

Cheapest layer for both risks on this architecture: Vitest preview HTTP integration reusing `createHttpClient` / `joinPlayer` / `createActiveSession` ([tests/helpers/http.ts](tests/helpers/http.ts)). Thin e2e is not required for the inspected authz contracts. NFR brute-force code guessing and RLS/PostgREST bypass remain out of Phase 3 scope (product NFR / Phase 1 deferral).

## Detailed Findings

### Risk #6 — Forged identity / outsider claim vs code capability

**Surfaces to prove (this inspected set):**

| Surface                              | Protection for #6                                                  |
| ------------------------------------ | ------------------------------------------------------------------ |
| `POST /api/play/claim`               | Cookie identity for `code` + RPC `claim_token` binding             |
| `POST /api/play/join`                | Active code required; optional token rebinds **same** session only |
| `GET /api/play/board`                | Code-gated public poll — **no** player cookie check                |
| `POST /api/sessions/{id}/undo-claim` | Logged-in GM + `gm_id = auth.uid()` in RPC                         |
| `GET /api/sessions/{id}/board`       | Logged-in GM + `getSessionWithCells(..., user.id)` `gm_id` filter  |
| `GET /play/{code}`                   | Same read model as board RPC; invalid code → 404                   |
| `GET /sessions/{id}`                 | Middleware login + owner filter → 404 if not GM                    |

**Claim deny path (inspected):** missing/invalid cookie → **401** before RPC ([claim.ts:37-41](src/pages/api/play/claim.ts)); unknown/inactive code with forged well-formed cookie → RPC `session_not_found` → **404** ([claim.ts:69-70](src/pages/api/play/claim.ts); matrix [http-contract-matrix.test.ts:90-97](tests/integration/http-contract-matrix.test.ts)); active code + fake `claimToken` → RPC `player_not_found` → **401** ([claim.ts:71-72](src/pages/api/play/claim.ts); migration [20261003190000:154-162](supabase/migrations/20261003190000_player_claim_token.sql)). Cookie `playerId` is not sent to the claim RPC — only `claimToken` is ([claim.ts:49-52](src/pages/api/play/claim.ts)).

**“Logged-in ⇒ can touch any session” (inspected GM APIs):** false for `GET /api/sessions/{id}/board` and undo — ownership via `gm_id` / `auth.uid()`. Play routes do **not** check `gm_id`: a logged-in GM with a known active code can join/poll/claim as a **player** the same way an outsider can (by design of join-by-code).

**Invalid code cannot see board (inspected):** `GET /api/play/board?code=` unknown → **404** ([board.ts:27-29](src/pages/api/play/board.ts); matrix [:55-58](tests/integration/http-contract-matrix.test.ts)); smoke asserts invalid play page 404 body ([scripts/smoke.mjs:110-123](scripts/smoke.mjs)). Pre-join valid code: smoke asserts phrase not in HTML until join ([smoke.mjs:213-218](scripts/smoke.mjs)) — SSR nick-form gate, while `GET /api/play/board` with that code still returns the snapshot without cookie ([board.ts:15-31](src/pages/api/play/board.ts)).

**Assert recommendations (cheapest):**

1. Create active session → forge cookie for that **real** code with random UUIDs → `POST /api/play/claim` → **401**; follow-up player board shows cell still free.
2. Player A joins session 1; use A’s cookie (or forged entry keyed to session 2’s code with A’s token) against session 2 claim → **401**; no occupancy change.
3. Signed-in GM (smoke account) → `GET/POST` board/undo on a session id owned by… _(cross-owner needs a second GM account or fixture; if only one test user exists, assert unknown id **404** already covered and document cross-owner as blocked gap or add second credentials)_.
4. Unknown code → play board **404** (already in matrix) + optional HTML `/play/{code}` **404** (smoke).

**Anti-patterns:** full browser login theater; treating public code-gated poll as a failure; kitchen-sink GM preview; sequential claim-only negatives without a live session; NFR 100k guess loop.

### Risk #8 — Unauthenticated MG create / list / preview

**MG entry points (inspected):**

| Method | Path                            | Guard                           | Anon outcome                      |
| ------ | ------------------------------- | ------------------------------- | --------------------------------- |
| GET    | `/sessions/new`                 | Middleware prefix `/sessions`   | **302** `/auth/signin`            |
| GET    | `/dashboard`                    | Middleware `/dashboard`         | **302** `/auth/signin`            |
| GET    | `/sessions/{id}`                | Middleware + page `locals.user` | **302** (middleware first)        |
| POST   | `/api/sessions`                 | Handler `locals.user`           | **401** JSON                      |
| GET    | `/api/sessions/{id}/board`      | Handler `locals.user`           | **401** JSON                      |
| POST   | `/api/sessions/{id}/undo-claim` | Origin then `locals.user`       | **401** (or **403** cross-origin) |

There is **no** `GET /api/sessions` list API on the inspected tree — MG list is SSR `GET /dashboard` only ([src/pages/dashboard/index.astro](src/pages/dashboard/index.astro)). `/api/*` is **not** in `PROTECTED_ROUTES` ([middleware.ts:4](src/middleware.ts)); each MG API must keep its own check.

**Kitchen sinks** under `/dashboard/*` and `/sessions/*` inherit middleware; PROD returns **404** before content. Test-plan anti-pattern: kitchen-sink-only proof — do not use them as the sole #8 evidence.

**Smoke vs gap:** smoke always checks anon dashboard + create page + create API ([smoke.mjs:98-108](scripts/smoke.mjs)); with creds, post-signout redirects for session id / new / dashboard ([smoke.mjs:201-210](scripts/smoke.mjs)). Matrix: anon GM board GET + undo ([http-contract-matrix.test.ts:43-47,100-108](tests/integration/http-contract-matrix.test.ts)); create anon 401 in create-session-board ([create-session-board.test.ts:52-60](tests/integration/create-session-board.test.ts)). Missing for Phase 3: anonymous GET with **live** session id asserting **401/302 and body without cells/phrases/code**; dashboard redirect body must not contain session list rows (redirect Location assert is enough if body is empty/login — verify once).

### Existing harness (reuse)

| Asset                                              | Role for Phase 3                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `tests/helpers/http.ts`                            | Cookie jar, Origin, `signIn`, `joinPlayer`, `createActiveSession`                      |
| `http-contract-matrix.test.ts` `forgePlayerCookie` | Local forge helper — extract or duplicate for live-session cases                       |
| `play-path-claim-undo.test.ts` board helpers       | Pattern for follow-up GET “board unchanged”                                            |
| `scripts/smoke.mjs`                                | Route-guard redirects + Origin 403 claim; not a substitute for live forged-token claim |

**Missing today for #6/#8 prove criteria:** dedicated abuse suite; forged cookie against **active** session; cross-code cookie mismatch; wrong-GM undo/board; systematic no-leak body checks on MG pages/APIs.

### Middleware vs play

`/play` and `/api/play/*` are intentionally unprotected by middleware ([middleware.ts:4](src/middleware.ts); archive player-join plan). Authz for play writes is cookie + RPC; for MG pages it is middleware + handler.

## Code References

- `src/middleware.ts:4-21` — `PROTECTED_ROUTES`, anonymous redirect
- `src/pages/api/play/claim.ts:18-72` — Origin, cookie identity, claim deny statuses
- `src/pages/api/play/board.ts:15-31` — public code-gated board poll
- `src/pages/api/play/join.ts` — join + cookie write / token rebind
- `src/lib/player-cookie.ts` — `rpg_player` parse; entries need UUID `claimToken`
- `src/pages/api/sessions/index.ts:21-25` — create requires login
- `src/pages/api/sessions/[id]/board.ts:17-35` — GM board 401 / owner 404
- `src/pages/api/sessions/[id]/undo-claim.ts` — GM undo auth
- `src/lib/services/sessions.service.ts:148-174` — list/get filter `gm_id`
- `supabase/migrations/20261003190000_player_claim_token.sql:76-91,154-162` — join rebind + claim token bind
- `supabase/migrations/20261003200000_undo_board_cell.sql:24-32` — undo ownership
- `tests/integration/http-contract-matrix.test.ts:21-108` — existing forged/anonymous negatives
- `tests/helpers/http.ts:204-247` — `joinPlayer` / `createActiveSession`
- `scripts/smoke.mjs:98-123,201-218` — MG redirects + invalid play + pre-join HTML

## Architecture Insights

- **Two capability types:** session **code** (read/join for active sessions) vs **claim_token** (write/claim). Risk #6’s “guessed code joins” is the product join model; abuse to lock is **impersonating a seat** or **acting as another GM**.
- **Auth split (preserve):** claim = player cookie + code; undo/GM board = Supabase user + ownership. Phase 2 research deferred forged-identity abuse here ([testing-play-path-claim-undo/research.md](context/changes/testing-play-path-claim-undo/research.md)).
- **RPC-authoritative player writes:** tests should assert HTTP status + follow-up board GET, not mirror app check-then-update logic.
- **No middleware on `/api`:** new MG APIs without `locals.user` would be exposed — Phase 3 should cover the three existing session APIs plus page guards named in Risk #8.

## Historical Context (from prior changes)

| Claim                                                         | Verdict                                                            | Notes                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Fix A: auth via `claim_token`; no public player ids on roster | **Supported** (shipped intent)                                     | Phase 2 research historical table; smoke roster hygiene                    |
| Forged cookie + unknown code → claim 404                      | **Supported**                                                      | Matrix `:90-97`                                                            |
| Forged cookie on **live** session fails claim                 | **Unknown until Phase 3 proves**                                   | No live-session forge case today                                           |
| “Logged-in ⇒ any session” false for GM APIs                   | **Supported** by `gm_id` filters; **unproven** by cross-owner test | Matrix covers unknown id only                                              |
| Code guessing NFR (&lt;1/100k) is Phase 3 suite work          | **Contradicted as Phase 3 scope**                                  | Product NFR (`prd.md`); rollout is authz/identity                          |
| Phase 1 deferred RLS bypass / join matrix / authz breadth     | **Supported**                                                      | Phase 1 plan-brief + cookbook §6.4 → Phase 3                               |
| Phase 2 deferred forged identity to #6/#8                     | **Supported**                                                      | Phase 2 research Architecture Insights                                     |
| Anon MG pages → login; no valid code → no board               | **Supported**                                                      | PRD Access Control `:136-137`; implemented as 302 / 404 on inspected paths |

Related archives: `context/archive/2026-10-03-player-join-shared-board/`, `context/archive/2026-10-03-player-claim-field-reward/` (impl-review Fix A), `context/archive/2026-09-27-gm-create-session-board/`.

## Related Research

- [context/changes/testing-play-path-claim-undo/research.md](context/changes/testing-play-path-claim-undo/research.md) — claim/undo happy path; Phase 3 handoff for forged identity
- [context/changes/testing-runner-bootstrap-board-integrity/research.md](context/changes/testing-runner-bootstrap-board-integrity/research.md) — Phase 1 deferrals (RLS bypass → Risk #6 later)

## Open Questions

1. **Cross-owner GM proof:** Does CI/local expose a second GM account (or can Phase 3 create one via signup API) so wrong-owner board/undo can be asserted, or is unknown-id **404** accepted as the stand-in for the “logged-in ⇒ any session” challenger?
2. **Join abuse depth:** Beyond claim forge, should Phase 3 assert join with stolen `claim_token` from session A against session B creates a **new** seat (expected) and cannot claim as A on B — or is claim-only sufficient?
3. **SSR vs API for #8 no-leak:** Prefer asserting anonymous `GET /api/sessions/{id}/board` body shape only, or also anonymous `GET /sessions/{id}` redirect without following (smoke-style Location check)?
