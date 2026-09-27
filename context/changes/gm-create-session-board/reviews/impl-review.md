<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: GM Create Session Board

- **Plan**: context/changes/gm-create-session-board/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Orphan session when cell insert fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/sessions.service.ts:84-86
- **Detail**: Agreed Phase 1 adaptation removed the transactional RPC. `createSession` inserts the session, then cells; on `cellsError` it rethrows with no cleanup. No owner DELETE policy → rare permanent 0-cell session that consumes a unique code. Documented in change.md Notes; still user-visible on dashboard and session page.
- **Fix A ⭐ Recommended**: Accept until S-05 (DELETE/close) and keep the Notes warning; optionally filter 0-cell sessions from the dashboard in a tiny follow-up.
  - Strength: Matches the documented user decision; avoids reintroducing Postgres BL.
  - Tradeoff: Orphans remain possible until S-05.
  - Confidence: HIGH — adaptation was explicit and Notes already cover it.
  - Blind spot: Frequency in production unknown (should be rare).
- **Fix B**: Add compensating delete (RLS DELETE for owner + cleanup on cellsError) or restore a transactional RPC.
  - Strength: Removes the orphan class entirely.
  - Tradeoff: Reopens the Phase 1 architecture decision; needs migration + policy review.
  - Confidence: MEDIUM — conflicts with the recorded “no DB RPC / no BL in Postgres” choice unless DELETE-only path is used.
  - Blind spot: Workers rollback vs migration coupling if RPC returns.
- **Decision**: Fixed via Fix A — accepted until S-05; Notes retained; no compensating delete/RPC

### F2 — RLS INSERT does not enforce board size/position invariants

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260927143000_sessions_and_board_cells.sql:19,54-65
- **Detail**: `position` only CHECK `>= 0` (no upper bound vs `size²`). `board_cells` INSERT policy only checks session ownership. The app path is disciplined via `generateBoard`, but an authenticated client with the public anon key + JWT could insert extra or out-of-range cells on own sessions, bypassing generator rules. Cross-tenant isolation still holds.
- **Fix A ⭐ Recommended**: Defer to a later slice; rely on app path for MVP. Document as known gap in change.md Notes.
  - Strength: No schema churn now; matches MVP timeline.
  - Tradeoff: Direct PostgREST writes can still corrupt own boards.
  - Confidence: HIGH — attack requires authenticated JWT and only affects own rows.
  - Blind spot: Whether any future client will talk to PostgREST directly.
- **Fix B**: Add a trigger/CHECK tying `position` to parent `sessions.size` (and optionally reject non-N² inserts).
  - Strength: Enforces invariants at the DB boundary.
  - Tradeoff: New migration; more Postgres logic (BL-ish) than current adaptation prefers.
  - Confidence: MEDIUM — CHECK across parent row needs a trigger, not a simple CHECK.
  - Blind spot: Interaction with future claim/regenerate columns.
- **Decision**: Fixed via Fix A — documented as known MVP gap in change.md Notes; deferred CHECK/trigger

### F3 — Plan Progress still claims RPC existed and was verified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/gm-create-session-board/plan.md:406-407
- **Detail**: Progress rows 1.2 and 1.3 (and Phase 1 success-criteria text) still require `create_session_with_cells` and “calling the RPC is rejected”, but the migration has no RPC and Notes document the adaptation. Code matches the adaptation; the Progress wording does not.
- **Fix**: Amend Progress 1.2/1.3 (and optionally Phase 1 criteria) to describe the no-RPC verification that was actually done (tables/policies/RLS anon probes without RPC).
- **Decision**: FIXED — Progress 1.2/1.3/1.6 wording amended to no-RPC adaptation

### F4 — Orphan sessions look like healthy sessions in UI

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:46-63; src/pages/sessions/[id].astro
- **Detail**: Fallout of F1 — list shows code/size/`active` with no cell-count signal; detail can render an empty grid with no error state.
- **Fix**: If `cells.length !== size²`, show a failure/empty state on the session page and optionally hide or badge the row on the dashboard.
- **Decision**: FIXED — incomplete board empty state on session page; dashboard badge deferred (needs cell-count query)

### F5 — Service reads trust RLS alone (no explicit gm_id filter)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/sessions.service.ts:95-99,102-115
- **Detail**: `listSessionsForGm` / `getSessionWithCells` omit `.eq("gm_id", …)`. Safe today with the user-scoped SSR client + RLS; would leak if a service-role client were reused later. Create path correctly sets `gm_id: user.id`.
- **Fix**: Add `.eq("gm_id", user.id)` (pass user id into the helpers) for defense-in-depth.
- **Decision**: FIXED — listSessionsForGm / getSessionWithCells take gmId and filter .eq("gm_id", gmId)

### F6 — Roadmap S-01 still Status in-progress after change implemented

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md (S-01 / gm-create-session-board)
- **Detail**: `/10x-implement` correctly flipped S-01 to `in-progress`. Change is now `implemented`; roadmap `done` is normally flipped by `/10x-archive`, so this is expected mid-lifecycle stale status — not an implementation bug.
- **Fix**: No code fix now; run `/10x-archive` when ready (or manually set Status: done if archiving is delayed).
- **Decision**: SKIPPED — leave for `/10x-archive`
