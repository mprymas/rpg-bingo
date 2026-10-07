---
date: 2026-10-06T13:08:43+02:00
researcher: Marcin
git_commit: 1a480f18cc1a0804d126a6558dd072f819dbf81f
branch: master
repository: rpg-bingo
topic: "Phase 1: runner bootstrap + board integrity (Risks #1, #2)"
tags: [research, codebase, create-session, board-cells, api-contract, smoke, test-runner]
status: complete
last_updated: 2026-10-06
last_updated_by: Marcin
---

# Research: Phase 1 — runner bootstrap + board integrity (Risks #1, #2)

**Date**: 2026-10-06T13:08:43+02:00
**Researcher**: Marcin
**Git Commit**: 1a480f18cc1a0804d126a6558dd072f819dbf81f
**Branch**: master
**Repository**: rpg-bingo

## Research Question

For test-plan Phase 1 (`testing-runner-bootstrap-board-integrity`), ground:

1. **Risk #1** — create-session inputs → persisted board shape → reward catalog contract; where wrong cell count, empty phrase, or unknown reward id can persist; what a playable-board proof must assert beyond “generate / HTTP OK”.
2. **Risk #2** — play/session API status mapping and client success gates; whether failures can look like success.
3. **Runner bootstrap** — what test infrastructure exists today vs what Phase 1 must add for integration/contract tests.

## Summary

On the inspected create API path (`POST /api/sessions` → `createSession` → `generateBoard` → insert), a **successful** response (`201` + `{ id, code }`) is produced only after `board_cells` insert returns without error (`sessions.service.ts:133-138`, `api/sessions/index.ts:55-60`). `generateBoard` builds exactly `size * size` cells on that path (`board-generator.ts:57`, `101-105`). Unknown reward UUIDs are rejected before generate/persist (`sessions.service.ts:92-97` → `400`). Zod rejects empty custom phrase text (`session.ts:4-5`).

The failure mode that still allows an **invalid persisted session** on this path is **non-atomic write**: session row insert can succeed, then cell insert fails and throws with **no session cleanup** (`sessions.service.ts:109-136`) — leaving a session with **0 cells**. Postgres does **not** enforce cell count = `size²` or non-blank `phrase` (`20260927143000_sessions_and_board_cells.sql:16-24`). Incomplete boards are detected later by SSR (`sessions/[id].astro:50-53` sets HTTP **422** when `cells.length !== size²`).

On inspected play/session **JSON** APIs, failures use **non-2xx** statuses; mutation clients gate on `status === 201` / `response.ok` / `409` plus body shape — not “any JSON”. Adjacent exception: `POST /api/play/join` uses **302 redirects** for many failures (browser navigation success, not JSON 200).

There is **no** unit/integration runner in `package.json`; the only automated behavioral gate is `scripts/smoke.mjs` (HTTP-only; covers auth plus create/join/claim status checks, not DB board-integrity asserts).

## Detailed Findings

### Risk #1 — create → board → rewards

**Entry chain (inspected)**

| Layer            | Anchor                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Form → POST body | `NewSessionForm.tsx:85-96` (filters empty custom texts before POST) |
| Client           | `useCreateSession.ts:13-22`                                         |
| API              | `src/pages/api/sessions/index.ts:20-83`                             |
| Service          | `sessions.service.ts:72-142`                                        |
| Generator        | `board-generator.ts:49-125`                                         |

**Persisted shape.** Inserted cell rows are `{ session_id, position, phrase, reward_id }` (`sessions.service.ts:126-133`). Expected cell count used in app code is `size * size` (generator `board-generator.ts:57`; zod `session.ts:30`; GM SSR `sessions/[id].astro:50-51`). Allowed sizes are 3|4|5 (`session.ts:19`; DB `sessions.size BETWEEN 3 AND 5` at migration `:8`) → expected counts **9, 16, or 25** when the board is complete.

**Wrong cell count**

- On successful create (no thrown error after cell insert), this path inserts the generator’s full array (`sessions.service.ts:126-136`); generator maps one cell per phrase after sizing the phrase list to `cells` (`board-generator.ts:57`, `96-105`).
- **Observed incomplete persist path:** if `board_cells` insert fails after `sessions` insert, the error is rethrown with **no delete** of the session (`sessions.service.ts:109-136`) → session can remain with **0** cells. API then returns **500** (`index.ts:79-82`), not 201 — so the client does not navigate (`useCreateSession.ts:19-22`), but the orphan row can still exist for later GM/player loads (SSR incomplete → **422**, `sessions/[id].astro:50-53`).
- DB has `UNIQUE(session_id, position)` and `position >= 0` but **no** check that row count equals `size²` or that `position < size²` (`20260927143000_…sql:16-24`).

**Empty phrase**

- Zod: `text` trim + `min(1)` (`session.ts:4-5`).
- Generator drops customs with `trim().length === 0` (`board-generator.ts:61-63`); does **not** reject whitespace-only strings from the **predefined** catalog pool on this path.
- DB: `phrase text NOT NULL` allows `''` (`20260927143000_…sql:20`). Catalog `phrases.text` is `NOT NULL` without a non-blank check in the phrases migration (inspected via worker; seed phrases in `supabase/seed.sql` are non-empty on that file’s rows).

**Unknown reward id**

- Zod validates UUID shape only (`session.ts:9-10`).
- Service loads catalog ids and throws `SessionServiceError("UNKNOWN_REWARD")` if any command id is missing (`sessions.service.ts:84-97`) → API **400** `"Nieznana nagroda"` (`index.ts:73-77`).
- DB FK `reward_id … REFERENCES public.rewards (id)` (`20260927143000_…sql:21`) blocks unknown non-null ids on insert.

**Implication for tests (settled facts, not a plan):** proving Risk #1 requires asserting **persisted** `board_cells` (count, phrase non-empty, `reward_id` null or in catalog) after create — not only HTTP 201 or generator unit internals. The orphan 0-cell path is a concrete integrity gap on the inspected write sequence.

### Risk #2 — API status + client success gates

**JSON endpoints (inspected status mapping)**

| Route                                | Success                | Failure statuses observed in handlers                           |
| ------------------------------------ | ---------------------- | --------------------------------------------------------------- |
| `POST /api/sessions`                 | **201** `{ id, code }` | **401, 400, 500** (`index.ts:21-82`)                            |
| `POST /api/play/claim`               | **200** `{ cell }`     | **403, 400, 401, 409, 404, 500**                                |
| `GET /api/play/board`                | **200** board DTO      | **400, 404, 500**                                               |
| `GET /api/sessions/[id]/board`       | **200**                | **401, 404, 500**                                               |
| `POST /api/sessions/[id]/undo-claim` | **200** `{ cell }`     | **403, 401, 404, 400, 500**                                     |
| `POST /api/play/join`                | **302** → play board   | Many failures **302** with query/`/play`; also **403/500** text |

Local `json(body, status)` helpers live **inside** route files; no shared `src/lib` response helper was found in the inspected grep.

**Client gates**

| Client         | Gate                                                        | Anchor                                           |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Create         | `response.status === 201` then navigate                     | `useCreateSession.ts:19-22`                      |
| Player claim   | `409` + conflict shape **or** `response.ok` + success shape | `PlayerBoard.tsx:187-196`                        |
| Player/GM poll | `response.ok` + board shape; else no update                 | `PlayerBoard.tsx:128-134`, `GmBoard.tsx:123-137` |
| GM undo        | `response.ok` **and** undo success shape                    | `GmBoard.tsx:184-195`                            |
| Join form      | native form POST; no status check                           | `JoinNickForm.tsx:17-27`                         |

On the inspected JSON mutation/poll clients, advancing requires a **status check**, not merely a JSON body. A concrete path where a play/session JSON handler returns **HTTP 200 + `{ error }`** and a client treats that as success was **not** found in the inspected handlers + clients.

**Smoke** asserts `actual.status === expected.status` (plus optional body checks) — `scripts/smoke.mjs` (~348-351 per worker; create expects **201**, claim conflict **409**). Smoke is HTTP-only (no DB board assert).

**Lesson prior:** SSR branded load errors should set non-2xx (`lessons.md:12-17`); incomplete board SSR already uses **422** (`sessions/[id].astro:52-53`).

### Runner / test base (Phase 1 bootstrap)

| Item                                            | Observed                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| vitest / jest / playwright / mocha / `*.test.*` | **Absent** from `package.json` scripts/deps (`package.json:5-61`) and repo globs                                |
| Automated behavioral gate                       | `npm run smoke` → `scripts/smoke.mjs` (`package.json:14`)                                                       |
| CI                                              | `ci` (lint/check/build) + `smoke` (local Supabase + preview + smoke); no suite job (`.github/workflows/ci.yml`) |
| Docs                                            | `AGENTS.md` / `test-plan.md` §4: no unit/integration runner yet; suite required after Phase 1                   |

Smoke covers more than auth (create **201**, join **302**, claim **200**/conflict **409**, board GET shape) but does **not** assert persisted cell count / empty phrase / unknown reward DB integrity.

No in-repo decision names which runner Phase 1 must install (plan says “cheapest runner” only).

## Code References

- `src/pages/api/sessions/index.ts:20-83` — create API status map
- `src/lib/services/sessions.service.ts:72-142` — catalog check, generate, two-step insert
- `src/lib/services/board-generator.ts:49-125` — `size²` cells, generation errors
- `src/lib/schemas/session.ts:1-47` — zod create constraints
- `src/components/hooks/useCreateSession.ts:19-32` — client success = **201**
- `src/pages/sessions/[id].astro:50-53` — incomplete board → **422**
- `supabase/migrations/20260927143000_sessions_and_board_cells.sql:16-24` — cell schema / FK / uniqueness; no count invariant
- `src/pages/api/play/claim.ts`, `board.ts`, `join.ts` — play API statuses
- `src/components/play/PlayerBoard.tsx:128-134,187-206` — poll/claim gates
- `src/components/sessions/GmBoard.tsx:123-137,184-195` — poll/undo gates
- `package.json:5-15` — scripts; smoke only
- `scripts/smoke.mjs` — HTTP status contract runner
- `.github/workflows/ci.yml` — ci + smoke jobs

## Architecture Insights

- Create persistence is **application-level sequential inserts**, not a transactional RPC (despite older archive plan text). Integrity of “create ⇒ N² cells” is therefore an app + test concern until DB/API atomicity changes.
- Clients already distinguish success by **HTTP status** (and shape). Contract tests should lock status classes + side effects, not full-body snapshots — matching test-plan anti-patterns.
- Read-time incomplete-board **422** is a safety net for Risk #1 orphans; it does not prevent the orphan write.
- Integration tests will need a **DB read path** (Supabase client against local stack) beyond smoke’s HTTP-only model; CI already starts local Supabase for smoke.

## Historical Context (from prior changes)

| Claim                                                                 | Verdict                                                                                                           | Notes                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| S-01: create success ⇒ N² cells, distinct phrases, positions `0…N²−1` | **Supported as product intent** (`context/archive/2026-09-27-gm-create-session-board/plan.md` persist invariants) | Matches generator behavior on success path                                    |
| S-01: persist via `create_session_with_cells` RPC                     | **Contradicted by current code**                                                                                  | Archive `change.md` adapted to two-step insert; `sessions.service.ts:109-136` |
| S-01: orphan 0-cell session possible on cell-insert failure           | **Supported**                                                                                                     | Same archive adaptation + current service                                     |
| Incomplete board → HTTP 422                                           | **Supported**                                                                                                     | Archive ui-session-board + `sessions/[id].astro:52-53`                        |
| Create API: 401/400/500; success 201 `{ id, code }`                   | **Supported**                                                                                                     | Archive plan + `index.ts` + client                                            |
| Client advances only on `status === 201`                              | **Supported**                                                                                                     | `useCreateSession.ts:19`                                                      |
| S-01 deferred unit runner (smoke + manual)                            | **Superseded** for testing strategy by `test-plan.md` Phase 1                                                     | Product contracts from S-01 still bind                                        |
| Prefer non-2xx for SSR branded errors                                 | **Supported** lesson                                                                                              | `lessons.md:12-17`                                                            |

## Related Research

- No prior `research.md` under `context/changes/testing-runner-bootstrap-board-integrity/`.
- Closest archive product research/plans: `context/archive/2026-09-27-gm-create-session-board/`, `context/archive/2026-10-01-ui-session-board/` (incomplete/422).

## Open Questions

1. **Product/plan choice:** Should Phase 1 tests only lock today’s successful-create invariants + API status contracts, or also require a failing/red case for the orphan 0-cell write (and possibly a fix in the same change)? Research documents the gap; `/10x-plan` must decide scope.
2. **Runner selection:** No settled choice in-repo (vitest vs node:test vs other). Plan must pick against “cheapest runner” + Cloudflare/Astro SSR realities.
3. **Blank catalog phrases:** Schema allows empty `phrases.text`; whether production/local DBs have such rows was not verified against a live database in this pass.
4. **RLS bypass of create API:** Authenticated owner can insert `board_cells` under RLS without generator rules — out of create-API path; whether Phase 1 scopes that abuse is a plan decision (Risk #6 is later phase).
