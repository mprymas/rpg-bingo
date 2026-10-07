# Runner bootstrap + board integrity — Plan Brief

> Full plan: `context/changes/testing-runner-bootstrap-board-integrity/plan.md`
> Research: `context/changes/testing-runner-bootstrap-board-integrity/research.md`

## What & Why

Phase 1 of the test rollout: install Vitest and protect create-session board integrity plus non-ambiguous HTTP failure contracts so broken boards and “JSON ⇒ success” regressions fail CI.

## Starting Point

Smoke-only behavioral gate; create path persists `size²` cells on success but has a known non-atomic orphan gap; clients already gate on HTTP status. No unit/integration runner in-repo yet.

## Desired End State

Vitest suite + CI wiring; create success proven via GM board GET invariants; thin JSON failure matrix; cookbook filled; orphan gap documented, not fixed.

## Key Decisions Made

| Decision         | Choice                                          | Why (1 sentence)                                                            | Source |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| Runner           | Vitest                                          | DX upgrade while integration still uses preview + local Supabase like smoke | Plan   |
| Orphan 0-cell    | Document only; no fix / no red test             | Keep Phase 1 test-only; product atomicity is a later change                 | Plan   |
| Contract surface | Create + thin JSON failure matrix               | Covers Risk #2 on core APIs without Phase 2/3 claim-race/authz work         | Plan   |
| Board assert     | Authenticated GM `GET /api/sessions/[id]/board` | No service-role helper; exercises real read path + status                   | Plan   |
| CI wiring        | Extend existing `smoke` job                     | Reuse one Supabase + preview bootstrap                                      | Plan   |
| Exclusions       | Blank catalog phrases + RLS bypass out          | Belong to later phases / not create-API integrity                           | Plan   |

## Scope

**In scope:**

- Vitest runner, npm scripts, HTTP/cookie helpers
- Create **201** → board invariants via GM board GET
- Create **401** / **400** (zod + unknown reward)
- Thin failure status matrix: GM/play board GET, claim, undo-claim
- CI smoke-job suite step; optional unit tests in `ci` job
- test-plan cookbook §6.1 / §6.2 / §6.4 / §6.5 Phase 1 notes; AGENTS pointer if still “no runner”

**Out of scope:**

- Orphan 0-cell product fix or stubbed red test
- Blank catalog phrase enforcement; RLS/PostgREST bypass (Risk #6)
- Claim **409** race, undo side effects, rejoin, join **302** matrix
- Full response body snapshots; Playwright/e2e; removing smoke

## Architecture / Approach

Vitest unit tests run in-process without Supabase. Integration/contract tests authenticate against `astro preview` (workerd) with a cookie jar, create sessions over HTTP, and prove side effects via GM board GET / status classes—never by treating any JSON body as success.

## Phases at a Glance

| Phase               | What it delivers               | Key risk                      |
| ------------------- | ------------------------------ | ----------------------------- |
| 1. Runner bootstrap | Vitest + helpers + seed unit   | Config / `@/*` alias friction |
| 2. Board integrity  | Create→board asserts + 401/400 | Flaky auth/cookie harness     |
| 3. HTTP contracts   | Failure status matrix          | Over-scoping into Phase 2     |
| 4. CI + cookbook    | smoke job wiring + cookbook    | Wall-time / env wiring        |

**Prerequisites:** Docker + local Supabase for integration; Node per `.nvmrc` (22.x) for app scripts.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Preview + cookie jar parity with smoke is enough for GM board GET under RLS.
- Seed catalogs remain non-empty for phrases/rewards in local Supabase.
- Extending smoke job wall time stays acceptable vs a separate test job.

## Success Criteria (Summary)

- Invalid/incomplete boards cannot look like successful creates in CI (success-path proof).
- Core JSON failure paths cannot return 2xx unnoticed.
- Agents have a documented Vitest pattern for the next rollout phases.
