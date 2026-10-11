# GM Regenerate Board Implementation Plan

## Overview

Deliver roadmap S-05 / FR-007: MG generates a new board with a new session code; the prior session becomes `closed` and points at the successor; players on the old code see a read-only closed board and are automatically rejoined into the new session (nick from cookie) via the existing ~5s poll — covered by integration tests and Playwright.

## Current State Analysis

- Create path: [`POST /api/sessions`](src/pages/api/sessions/index.ts) → [`createSession`](src/lib/services/sessions.service.ts) → [`generateBoard`](src/lib/services/board-generator.ts); redirect to `/sessions/{id}`.
- Sessions RLS: SELECT + INSERT for owning GM only — no UPDATE/DELETE ([`20260927143000_sessions_and_board_cells.sql`](supabase/migrations/20260927143000_sessions_and_board_cells.sql)). `status` is `active`|`closed` but nothing sets `closed`.
- Custom phrases / reward counts are not stored on `sessions` — only on `board_cells` after generate.
- Player board: [`getActiveBoardByCode`](src/lib/services/sessions.service.ts) / [`GET /api/play/board`](src/pages/api/play/board.ts) — active only; closed today becomes 404 “Nie znaleziono sesji” ([`play/[code].astro`](src/pages/play/[code].astro)).
- Identity: [`rpg_player` cookie](src/lib/player-cookie.ts) keyed by code; join via `join_session_player`.
- Undo pattern to mirror for GM mutations: [`GmBoard`](src/components/sessions/GmBoard.tsx) → `POST …/undo-claim`.
- Dashboard already labels closed status ([`DashboardPanel.astro`](src/components/dashboard/DashboardPanel.astro)) but lists all sessions with no toggle.
- Prior S-01 brief settled entity model: regenerate = **new session row**, not in-place cell rewrite. PRD Socrates rejected multi-board under one code; this plan keeps new code but softens rejoin via auto-join.

## Desired End State

- From an active GM board, MG confirms → create form prefills **size + reward counts** (phrases empty) → submit creates a new session, closes the source with `replaced_by_session_id`, redirects to the new GM board.
- Players polling/loading the old code get a **closed read-only** board (claims disabled). If a successor exists and a nick is available from the cookie, the client **auto-joins** the new code and redirects to `/play/{newCode}` without a nick form.
- Unknown codes still 404. Closed-without-successor stays read-only with no redirect. Dashboard defaults to active sessions with a “Pokaż zamknięte” toggle.
- Verified by HTTP integration contracts + Playwright regenerate → player handoff.

### Key Discoveries

- No regenerate stub under `src/`; closest reuse is create + undo API shape.
- Closing without a successor link cannot drive auto-redirect — needs `replaced_by_session_id` (or equivalent) on `sessions`.
- Auto-rejoin must **not** reuse the old `claimToken` across session ids (`join_session_player` rebind is session-scoped).
- Revealing that a closed code “existed” is an intentional product override of S-02’s unknown≡closed not-found rule for **closed** rows only; unknown codes stay opaque 404.

## What We're NOT Doing

- Hard DELETE of sessions (separate shape seed: “usuwanie sesji przez MG”).
- In-place board rewrite / same code, multi-board.
- Persisting custom phrases or guaranteed flags for reuse; phrase prefill is out (empty on regenerate form).
- Websockets / push; handoff is poll/load driven only.
- Atomic create+close RPC (create-then-close with retry instead).
- Admin catalog changes, team rewards, undo changes beyond closed disabling claims on player side.

## Implementation Approach

1. Add nullable `sessions.replaced_by_session_id` FK + owner-only way to set `status = closed` and the successor (SECURITY DEFINER RPC mirroring claim/undo for invariant checks).
2. Extend create command with optional `replaceSessionId`; after successful create, close source → set successor; on close failure return 201 with `closeError` and retry via `POST /api/sessions/[id]/close`.
3. GM UX: confirm on [`/sessions/[id]`](src/pages/sessions/[id].astro) / `GmBoard` → `/sessions/new?from={id}`; SSR loads prefill (size + reward counts from cells); wire `useCreateSession` to send `replaceSessionId`.
4. Player: board fetch returns active **or** closed snapshots with `status` and optional `successorCode`; SSR + `PlayerBoard` render read-only when closed; when `successorCode` + nick available → `POST /api/play/join` then navigate to new code.
5. Dashboard client toggle; kitchen-sink states; integration + Playwright.

## Critical Implementation Details

- **State sequencing:** Always insert the new session (+ cells) before closing the source. Never close-first. If close fails, MG lands on the new board with a warning and can retry close; dual-active is transient and acceptable.
- **Auto-rejoin nick source:** Prefer identity nick for the **old** code, else `lastNick` from the cookie. Do not send the old `claimToken` when joining the successor.
- **Closed vs unknown:** Only rows with `status = closed` become readable closed boards. Missing/malformed codes remain 404 with the existing copy.

---

## Phase 1: Close + successor model

### Overview

Schema and service/API to close an owned active session and link it to a replacement session id.

### Changes Required

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_session_close_replaced_by.sql` (new)

**Intent**: Persist successor link and allow GM to close a session safely.

**Contract**: Add nullable `sessions.replaced_by_session_id uuid references sessions(id)`; RPC `close_session_as_replaced(p_session_id, p_replaced_by)` that verifies `auth.uid() = gm_id`, source `active`, replacement exists and same `gm_id`, then sets `status = closed` and `replaced_by_session_id`. Regenerate `src/db/database.types.ts`. No DELETE policy.

#### 2. Service + HTTP close/retry

**File**: [`src/lib/services/sessions.service.ts`](src/lib/services/sessions.service.ts), new route `src/pages/api/sessions/[id]/close.ts`, types/schemas under `src/types.ts` / `src/lib/schemas/`

**Intent**: Expose close-with-successor for create flow and retry after partial failure.

**Contract**: `closeSessionAsReplaced(supabase, { sessionId, replacedBySessionId })`; `POST /api/sessions/[id]/close` with zod body `{ replacedBySessionId }`; auth + origin guard like undo-claim; domain errors → 4xx; success `{ ok: true }` or closed session summary.

### Success Criteria

#### Automated Verification

- Migration applies on local Supabase; generated types include `replaced_by_session_id` and the RPC
- Unit/service tests for close happy path + foreign GM / already closed / missing replacement (if pure error mapping is extracted)
- `npm run lint` passes for touched files

#### Manual Verification

- Via SQL or a temporary service call: closing session A with replacement B sets `closed` and FK; player active RPC no longer returns A as active

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: MG regenerate path

### Overview

Confirm CTA, create-form prefill, create-then-close wiring, close-failure UX.

### Changes Required

#### 1. Create API accepts replaceSessionId

**File**: [`src/pages/api/sessions/index.ts`](src/pages/api/sessions/index.ts), [`src/lib/schemas/session.ts`](src/lib/schemas/session.ts), [`useCreateSession.ts`](src/components/hooks/useCreateSession.ts)

**Intent**: One happy-path request creates the new board and closes the source.

**Contract**: Optional `replaceSessionId` (uuid) on `CreateSessionCommand`. After `createSession` succeeds, call `closeSessionAsReplaced`. Response 201 `{ id, code, closeError?: string }`; redirect to `/sessions/{newId}` always when create succeeded; when `closeError` is set, surface warning and retry close via `POST /api/sessions/{sourceId}/close` with `{ replacedBySessionId: newId }`.

#### 2. Prefill create form from `?from=`

**File**: [`src/pages/sessions/new/index.astro`](src/pages/sessions/new/index.astro), [`NewSessionForm.tsx`](src/components/sessions/NewSessionForm.tsx)

**Intent**: Regenerate reuses size and reward counts without re-typing; phrases stay empty.

**Contract**: When `from` is an owned session id, load `size` and aggregate `reward_id → count` from `board_cells`; pass initial values into the form; submit includes `replaceSessionId: from`. Unauthorized/missing `from` → ignore prefill (plain new session).

#### 3. GM confirm CTA

**File**: [`src/pages/sessions/[id].astro`](src/pages/sessions/[id].astro), [`GmBoard.tsx`](src/components/sessions/GmBoard.tsx) or small sibling island, [`sessions/board/kitchen-sink.astro`](src/pages/sessions/board/kitchen-sink.astro)

**Intent**: Prevent accidental regenerate; only on `active` sessions.

**Contract**: Confirm copy states new board + new code + players move/rejoin; on confirm navigate to `/sessions/new?from={id}`. Hidden/disabled when `status !== active`. Kitchen-sink covers confirm + closed (no CTA).

### Success Criteria

#### Automated Verification

- Integration: create with `replaceSessionId` closes source; foreign `from` rejected; close retry endpoint works after simulated close failure path
- Lint / `astro check` clean for touched files

#### Manual Verification

- Kitchen-sink + real flow: confirm → form shows size/rewards prefilled, phrases empty → submit → new code on GM page; old session closed with successor set
- Close-failure warning appears when close is forced to fail (or retried successfully via UI)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Player closed board + auto-rejoin

### Overview

Closed codes are readable and non-claimable; successor triggers automatic join + redirect.

### Changes Required

#### 1. Board snapshot for active and closed

**File**: new/extended SQL RPC, [`sessions.service.ts`](src/lib/services/sessions.service.ts), [`GET /api/play/board`](src/pages/api/play/board.ts), [`PlayerBoard` type](src/types.ts), [`play/[code].astro`](src/pages/play/[code].astro)

**Intent**: Replace active-only 404 for closed sessions with a closed snapshot.

**Contract**: Player board DTO gains `status: SessionStatus` and optional `successorCode: string | null` (from joined replacement session). Unknown code → 404. Closed → 200 + cells/players + successorCode. Claims and join for **closed** codes remain rejected (join only for active successor).

#### 2. Auto-rejoin client path

**File**: [`src/components/play/PlayerBoard.tsx`](src/components/play/PlayerBoard.tsx), join API reuse [`POST /api/play/join`](src/pages/api/play/join.ts), cookie helpers

**Intent**: Players already at the table move to the new board without typing the code.

**Contract**: On SSR load or poll, if `status === closed` and `successorCode` and nick available (old-code identity nick else `lastNick`), POST join with that nick (no old claimToken), write cookie for new code, `location.assign(/play/{successorCode})`. While closed and not redirecting: render board read-only (no claim clicks); show closed state chrome. If closed without nick: read-only + display successor code for manual entry. If closed without successor: read-only only.

#### 3. Kitchen-sink player/GM closed states

**File**: play/board kitchen sinks as applicable; extend [`sessions/board/kitchen-sink.astro`](src/pages/sessions/board/kitchen-sink.astro)

**Intent**: Visual gate for closed read-only and handoff messaging without production data.

### Success Criteria

#### Automated Verification

- Integration: after regenerate, old code board returns closed + successorCode; claim on old code fails; auto-join path to new code succeeds (HTTP-level); unknown code still 404
- Lint clean

#### Manual Verification

- Two browsers: MG regenerates; player within ~10s lands on new board joined; opening old code shows read-only closed board (and redirects/auto-joins when nick present)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Dashboard toggle + verification

### Overview

Active-default dashboard list with “Pokaż zamknięte”, plus full automated + e2e coverage.

### Changes Required

#### 1. Dashboard filter toggle

**File**: [`DashboardPanel.astro`](src/components/dashboard/DashboardPanel.astro) / small React island, [`dashboard/kitchen-sink.astro`](src/pages/dashboard/kitchen-sink.astro), optionally [`listSessionsForGm`](src/lib/services/sessions.service.ts)

**Intent**: Default mental model is current tables; closed history is opt-in.

**Contract**: Default view lists `status === active` only; toggle “Pokaż zamknięte” reveals closed rows (already labeled). Kitchen-sink shows both modes.

#### 2. Integration + Playwright

**File**: `tests/integration/*`, `tests/e2e/*` (new or extend existing play-path tests)

**Intent**: Lock HTTP contracts and the browser-level regenerate → player handoff.

**Contract**: Integration covers create+replace, close auth matrix, closed board read, claim blocked, join successor. Playwright: MG confirm → create → player on old code auto-moves to new code (reuse `E2E_USERNAME` / `E2E_PASSWORD` patterns).

### Success Criteria

#### Automated Verification

- `npm run test:integration` (preview) includes regenerate/close/closed-board cases
- `npm run test:e2e` covers regenerate → player auto-rejoin
- `npm run lint` / unit suite green

#### Manual Verification

- Dashboard toggle hides/shows closed after a real regenerate
- End-to-end table feel: new code spoken/shown on GM page matches where players land

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests

- Prefill aggregation (reward counts from cells)
- Cookie nick selection for auto-rejoin
- Pure mappers / close error mapping when extracted

### Integration Tests

- HTTP matrix for close / create-replace / board-closed
- Play-path regenerate scenario (closed + successor, claim blocked, join successor)

### Manual Testing Steps

1. Kitchen-sinks for confirm, closed GM board, dashboard toggle
2. Two-device poll timing after regenerate
3. Close-failure retry path
4. Closed-without-successor read-only (no redirect)

## Migration Notes

- Additive column + RPC; existing active sessions get `replaced_by_session_id = null`.
- Do not `supabase db reset` on hosted ([`lessons.md`](context/foundation/lessons.md)).
- Rollback: stop calling close; column/RPC can remain unused (backward compatible).

## References

- PRD FR-007: [`context/foundation/prd.md`](context/foundation/prd.md)
- Roadmap S-05: [`context/foundation/roadmap.md`](context/foundation/roadmap.md)
- S-01 entity model (new session on regenerate): `context/archive/2026-09-27-gm-create-session-board/plan-brief.md`
- Undo API pattern: `src/pages/api/sessions/[id]/undo-claim.ts`
- Player cookie/join: `src/lib/player-cookie.ts`, `src/pages/api/play/join.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Close + successor model

#### Automated

- [x] 1.1 Migration applies on local Supabase; generated types include replaced_by_session_id and the RPC — 4b57341
- [x] 1.2 Unit/service tests for close happy path + foreign GM / already closed / missing replacement (if pure error mapping is extracted) — 4b57341
- [x] 1.3 npm run lint passes for touched files — 4b57341

#### Manual

- [ ] 1.4 Closing session A with replacement B sets closed and FK; player active RPC no longer returns A as active

### Phase 2: MG regenerate path

#### Automated

- [x] 2.1 Integration: create with replaceSessionId closes source; foreign from rejected; close retry endpoint works after simulated close failure path
- [x] 2.2 Lint / astro check clean for touched files

#### Manual

- [ ] 2.3 Confirm → form prefills size/rewards, phrases empty → submit → new GM board; old session closed with successor
- [ ] 2.4 Close-failure warning + successful retry close via UI

### Phase 3: Player closed board + auto-rejoin

#### Automated

- [ ] 3.1 Integration: old code returns closed + successorCode; claim on old fails; join successor succeeds; unknown still 404
- [ ] 3.2 Lint clean

#### Manual

- [ ] 3.3 Two browsers: player auto-lands on new board within ~10s; old code read-only closed when opened

### Phase 4: Dashboard toggle + verification

#### Automated

- [ ] 4.1 Integration suite includes regenerate/close/closed-board cases
- [ ] 4.2 Playwright covers regenerate → player auto-rejoin
- [ ] 4.3 npm run lint / unit suite green

#### Manual

- [ ] 4.4 Dashboard toggle hides/shows closed after real regenerate
- [ ] 4.5 GM new code matches where players land in a full table run
