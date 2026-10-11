# GM Delete Session Implementation Plan

## Overview

MG can remove clutter from the dashboard by hard-deleting any owned session (active or closed) after an AlertDialog confirmation. The row is removed via SECURITY DEFINER RPC (CASCADE children); without confirmation nothing is deleted. Players treating a deleted code like unknown get 404.

## Current State Analysis

- Soft close only: `close_session_as_replaced` sets `status=closed` + `replaced_by_session_id`; no hard delete API/UI/RLS ([`20261011133000_session_close_replaced_by.sql`](../../../supabase/migrations/20261011133000_session_close_replaced_by.sql)).
- Dashboard lists via SSR `listSessionsForGm` → [`DashboardSessionList.tsx`](../../../src/components/dashboard/DashboardSessionList.tsx) (full-row `<a>`; no row actions).
- Child tables already `ON DELETE CASCADE` from `sessions`; `replaced_by_session_id` is `ON DELETE SET NULL`.
- Confirm UX elsewhere is inline (`GmRegenerateControls`); no `alert-dialog` primitive yet. Mutations use auth + `isAllowedRequestOrigin` ([`close.ts`](../../../src/pages/api/sessions/[id]/close.ts)).
- Product: US-02 / FR-003 in [`prd-v2.md`](../../foundation/prd-v2.md); roadmap S-03 `gm-delete-session` status `ready`.

### Key Discoveries

- Close route pattern to mirror: origin → auth → uuid param → service/RPC → 4xx map → `reportError` on 500 ([`close.ts:20-78`](../../../src/pages/api/sessions/[id]/close.ts)).
- Error mapper pattern: `closeSessionAsReplacedErrorFromMessage` ([`sessions.service.ts:402-408`](../../../src/lib/services/sessions.service.ts)).
- Dashboard files already in `SCOPED_FILES` for ui-literals; new dashboard components must be added to that list.
- E2E still notes no session-delete UI ([`seed.spec.ts`](../../../tests/e2e/seed.spec.ts)); orphan cleanup becomes possible after this slice (test-plan note only).

## Desired End State

MG opens `/dashboard`, chooses Usuń on a row, confirms in AlertDialog, and the session disappears from the list (any status). Cancel leaves data unchanged. Deleted codes return 404 on play board/join/claim like unknown codes. Integration tests lock the HTTP matrix.

## What We're NOT Doing

- Soft-delete / hide flag / “close without successor” as a substitute for delete
- Delete from `/sessions/[id]` (dashboard list only)
- Type-to-confirm or stronger confirm for active beyond warning copy
- Playwright e2e for delete
- Bulk delete, undo/recycle bin, admin purge
- Changing close/regenerate or player closed-board snapshot for non-deleted codes
- Adding broad RLS `DELETE` policies on `sessions` (RPC only)

## Implementation Approach

1. Migration: `delete_session(uuid)` SECURITY DEFINER — owner check; delete for any status; foreign/missing → `session_not_found`.
2. Service + `DELETE /api/sessions/[id]` (new `src/pages/api/sessions/[id].ts`) mirroring close auth/origin; bodyless; `{ ok: true }` on success.
3. `npx shadcn@latest add alert-dialog`; refactor list rows so navigate and delete are separate controls; AlertDialog with status-aware copy; success → full navigation reload of `/dashboard`.
4. Kitchen-sink states for confirm (active vs closed); integration tests; test-plan cookbook line for delete + orphan note update.

## Critical Implementation Details

- **Row architecture:** Do not nest the delete control inside the session `<a>`. Split into a row container with a link (or navigate affordance) and a separate delete trigger so keyboard/pointer targets stay valid.
- **RPC not RLS DELETE:** Keep the “no DELETE policy” posture from close; only the SECURITY DEFINER function deletes the row (same rationale as `20261011133000_session_close_replaced_by.sql`).
- **Successor links:** Deleting a session that others reference via `replaced_by_session_id` nulls those FKs; deleting an active session with live players yields 404 on next play poll — intentional.

---

## Phase 1: Delete contract (DB + API)

### Overview

Ship the irreversible delete mutation end-to-end at the HTTP boundary before any UI.

### Changes Required

#### 1. Migration + RPC

**File**: `supabase/migrations/YYYYMMDDHHMMSS_delete_session.sql` (timestamp at implement time)

**Intent**: Allow an owning GM to hard-delete a session of any status without granting table DELETE via RLS.

**Contract**: Function `public.delete_session(p_session_id uuid) RETURNS void`, `SECURITY DEFINER`, `SET search_path = public`. Load `gm_id`; if null or `gm_id IS DISTINCT FROM auth.uid()` raise `session_not_found` (`P0002`); else `DELETE FROM sessions WHERE id = p_session_id` (re-check owner). `REVOKE ALL` from `PUBLIC`; `GRANT EXECUTE` to `authenticated`. No new DELETE RLS policy.

#### 2. Service + error type

**File**: `src/lib/services/sessions.service.ts` (and colocated unit test file)

**Intent**: Thin RPC wrapper and pure message mapper, matching close/undo.

**Contract**: `deleteSession(supabase, { sessionId }) → { ok: true }`; `DeleteSessionError` with code `SESSION_NOT_FOUND`; `deleteSessionErrorFromMessage` maps `session_not_found`. Unit-test the mapper.

#### 3. API route

**File**: `src/pages/api/sessions/[id].ts` (new)

**Intent**: Authenticated, origin-checked hard delete for the path id.

**Contract**: `export const prerender = false`; `export const DELETE`. Same uuid pattern and JSON helper style as close. No body. Map `SESSION_NOT_FOUND` → 404 `{ error: "Nie znaleziono sesji" }`; success → 200 `{ ok: true }`; 500 via `reportError` with route `DELETE /api/sessions/[id]`. Coexists with `[id]/close.ts` etc.

#### 4. Shared type

**File**: `src/types.ts`

**Intent**: Type the success payload like close.

**Contract**: `DeleteSessionSuccessResponse` with `{ ok: true }` (or reuse a shared `OkResponse` if one already fits without broadening scope).

### Success Criteria

#### Automated Verification

- Migration applies on local Supabase (`npx supabase db reset` or project-equivalent migrate used in this repo)
- Unit tests for delete error mapper pass: `npm run test:unit`
- `astro check` / typecheck path used in CI passes for touched TS
- Lint passes on new API/service files: `npm run lint`

#### Manual Verification

- Authenticated `DELETE /api/sessions/{ownedId}` returns 200 and row is gone from DB (active and closed samples)
- Foreign GM / unknown id → 404; unauthenticated → 401; bad origin → 403

**Implementation Note**: Pause for human confirmation of manual checks before Phase 2.

---

## Phase 2: Dashboard delete UX

### Overview

MG deletes from the session list via AlertDialog; cancel is a no-op; success refreshes the SSR list.

### Changes Required

#### 1. shadcn AlertDialog

**File**: `src/components/ui/alert-dialog.tsx` (via `npx shadcn@latest add alert-dialog`)

**Intent**: Modal confirm primitive consistent with the existing new-york / tokenized UI kit.

**Contract**: Standard shadcn alert-dialog wired to existing tokens; no hex/palette literals in views.

#### 2. Session list row + delete flow

**File**: `src/components/dashboard/DashboardSessionList.tsx` (and small extracted hook/component under `src/components/dashboard/` or `hooks/` if needed)

**Intent**: Per-row Usuń opens AlertDialog; confirm calls `DELETE /api/sessions/{id}`; success reloads `/dashboard`; errors show inline/dialog message without removing the row.

**Contract**:
- Row: separate navigation target and delete trigger (no button inside `<a>`).
- Dialog copy: closed — short irreversible warning; active — stronger warning that players lose the live board.
- Same one-step confirm for both statuses (Anuluj / Usuń).
- `demo` kitchen-sink mode must not call the real API.
- After success: full page navigation to `/dashboard` (SSR list refresh).
- Extend ui-literals `SCOPED_FILES` if new dashboard files are added.

#### 3. Kitchen-sink

**File**: `src/pages/dashboard/kitchen-sink.astro`

**Intent**: Visual gate for delete confirm states.

**Contract**: Sections for confirm-open on active and on closed (and optional error). Reuse `demo` / props pattern already used for focus and show-closed. Prod still 404s.

### Success Criteria

#### Automated Verification

- `npm run lint` (includes ui-literals on dashboard files)
- `astro check` / CI typecheck passes for UI changes

#### Manual Verification

- `/dashboard`: Usuń → cancel → row remains; confirm on closed → row gone; confirm on active → row gone and play code 404s
- `/dashboard/kitchen-sink`: confirm states render with tokens; demo does not hit API
- Keyboard: dialog focus trap / Escape cancel behaves reasonably

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Integration verification

### Overview

Lock the HTTP contract and player 404 behavior; document delete in the test cookbook.

### Changes Required

#### 1. Integration suite

**File**: `tests/integration/delete-session.test.ts` (new; mirror `tests/integration/close-session.test.ts`)

**Intent**: Auth/ownership/status matrix + post-delete player board 404.

**Contract** (minimum cases):
- Unauthenticated DELETE → 401 + `{ error }`
- Unknown id → 404
- Foreign GM → 404; owner row unchanged
- Owner deletes **active** → 200 `{ ok: true }`; subsequent DELETE → 404; `GET /api/play/board?code=…` → 404
- Owner deletes **closed** (create + close-as-replaced or fixture) → 200; gone
- Use existing helpers (`createHttpClient`, `createActiveSession`, second GM credentials)

#### 2. Test-plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Point CI/cookbook at the new suite; note orphans are no longer forced by missing delete UI.

**Contract**: Add a delete-session bullet alongside close/replace entries; adjust the “orphan sessions acceptable when no session-delete UI” note so it reflects delete availability for cleanup (without requiring e2e to always clean up).

### Success Criteria

#### Automated Verification

- `npm run test:integration` passes with `PREVIEW_BASE_URL`/`BASE_URL` + credentials (same as close suite)
- Unit suite still green: `npm run test:unit`

#### Manual Verification

- Spot-check one active delete in UI against the same session the integration path covers mentally (list empty of that code; play 404)

---

## Testing Strategy

### Unit Tests

- `deleteSessionErrorFromMessage` mapping for `session_not_found` and non-match → null

### Integration Tests

- Auth matrix and happy paths above; player board 404 after delete

### Manual Testing Steps

1. Sign in as GM; create a throwaway session; Usuń → Anuluj → still listed
2. Confirm delete on closed session (toggle “Pokaż zamknięte”) → disappears
3. Confirm delete on active while a second browser has the play board → next poll/load 404
4. Kitchen-sink confirm states look correct under Vintage Paper tokens

## Performance Considerations

Single-row DELETE with CASCADE; dashboard reload is full navigation — acceptable at small table scale. No list API or realtime required.

## Migration Notes

Additive RPC only; backward compatible. No backfill. Deploy migration before or with Worker code that calls the RPC. Rollback of code leaves unused RPC (safe); do not drop RPC until code no longer references it.

## References

- Roadmap S-03: `context/foundation/roadmap.md`
- PRD US-02: `context/foundation/prd-v2.md`
- Close pattern: `src/pages/api/sessions/[id]/close.ts`, `src/lib/services/sessions.service.ts`
- Archived regenerate (hard DELETE deferred): `context/archive/2026-10-11-gm-regenerate-board/`
- Test cookbook: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Delete contract (DB + API)

#### Automated

- [ ] 1.1 Migration applies on local Supabase
- [x] 1.2 Unit tests for delete error mapper pass (`npm run test:unit`) — 55bab84
- [x] 1.3 Typecheck passes for touched TS — 55bab84
- [x] 1.4 Lint passes on new API/service files (`npm run lint`) — 55bab84

#### Manual

- [ ] 1.5 Authenticated DELETE on owned active and closed sessions returns 200 and removes DB rows
- [ ] 1.6 Foreign/unknown → 404; unauthenticated → 401; bad origin → 403

### Phase 2: Dashboard delete UX

#### Automated

- [x] 2.1 Lint including ui-literals passes (`npm run lint`) — 0fe7c19
- [x] 2.2 Typecheck passes for UI changes — 0fe7c19

#### Manual

- [ ] 2.3 Dashboard cancel leaves row; confirm removes closed and active rows; play code 404s after active delete
- [ ] 2.4 Kitchen-sink confirm states render; demo does not call API
- [ ] 2.5 AlertDialog keyboard/focus behavior acceptable

### Phase 3: Integration verification

#### Automated

- [ ] 3.1 Integration delete suite passes (`npm run test:integration`)
- [x] 3.2 Unit suite still green (`npm run test:unit`)

#### Manual

- [ ] 3.3 Spot-check one active delete in UI vs play 404
