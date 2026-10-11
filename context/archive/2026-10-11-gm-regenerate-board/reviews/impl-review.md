<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: GM Regenerate Board

- **Plan**: context/changes/gm-regenerate-board/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 7 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

Automated checks run during the review: `npm run lint` passed (check-ui-literals ok, 34 files), `npm run test:unit` passed (25 tests), `npx astro check` passed (0 errors). `npm run test:integration` and `npm run test:e2e` were not re-run. They need a local Supabase and a preview, and CI has not run on the 7 unpushed commits.

Unplanned changes, all harmless or needed: JSON mode on `POST /api/play/join` (auto-rejoin needs it), a `replacedBySessionId` tag on `reportError`, the new views added to the `check-ui-literals.mjs` scope, and a `joinInputId` prop on `DashboardPanel`. Every item in "What We're NOT Doing" is respected.

## Findings

### F1 — Auto-rejoin retries forever on permanent failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/play/PlayerBoard.tsx:183-189, 198
- **Detail**: A failed join resets `rejoinStartedRef` to `false`, so `onPolledBoard` calls `autoRejoin` again on every 5s poll. Failures that won't change on retry (409 table full, 404 successor already closed, 400 nick rejected) re-POST forever, and the UI flips between "Przechodzenie do nowej sesji…" and the manual successor link.
- **Fix**: On a 4xx response, keep `rejoinStartedRef` set and leave the manual link visible. Only allow another attempt after a network error or 5xx.
- **Decision**: FIXED

### F2 — Regenerating from an already-closed source leaves a stray active session

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/sessions/new/index.astro:30-39; src/pages/api/sessions/index.ts:72-91
- **Detail**: The prefill never checks `source.status`. A second tab, a stale form, or a hand-edited `?from=<closed id>` still sends `replaceSessionId`. The new session C is created, closing the source fails with `SESSION_NOT_ACTIVE`, and the GM lands on C with a retry banner that returns 409 on every click. C stays active, while players were already sent to the real successor B.
- **Fix**: Build the prefill (and send `replaceSessionId`) only when `source.status === "active"`. When `closeError` comes from `SESSION_NOT_ACTIVE`, show it as final, without a retry button.
  - Strength: Closes the only way a GM can reach this state (the CTA is already hidden on closed boards). It's a two-line guard at the source.
  - Tradeoff: A GM on a stale tab silently gets a plain new session, unless the form also shows that the source is already closed.
  - Confidence: HIGH — the prefill code and the error mapping were both verified in the source.
  - Blind spot: Two tabs submitting at the same moment from an active source still race. The atomic UPDATE stops a double close, but the second tab still creates an extra session.
- **Decision**: FIXED (prefill requires an active source; CloseRetryBanner hides the retry button after a 409)

### F3 — Prefill failures are swallowed, so regenerate silently becomes a plain new session

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/sessions/new/index.astro:40-42
- **Detail**: `catch {}` hides database errors without calling `reportError`. If loading the source fails, `prefill` is null, so `replaceSessionId` is never sent. The GM gets a new board, the old session stays active, and players are never redirected. Nothing on the form shows that a replacement was intended or that it failed. This is the same "hidden production error" pattern the observability audit targets.
- **Fix**: Call `reportError` in the catch (route `/sessions/new?from`). When `from` is present but no prefill was produced, show an inline note on the form (e.g. "Nie udało się wczytać poprzedniej sesji — zostanie utworzona nowa, niezależna sesja").
  - Strength: Makes the failure visible both in Sentry and to the GM. Matches how other SSR loads in this codebase report errors.
  - Tradeoff: Needs a small new prop/state on `NewSessionForm` and some extra copy.
  - Confidence: HIGH — the swallowed catch was verified.
  - Blind spot: Haven't decided whether a non-owned `from` should also show the note (it currently returns null without throwing).
- **Decision**: FIXED (reportError in the catch; the note shows whenever `from` is present without a prefill, including non-owned, missing, closed, or failed loads)

### F4 — `POST /api/sessions` lacks the same-origin guard but now changes another session

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/sessions/index.ts:45
- **Detail**: `close.ts`, `undo-claim.ts`, `claim.ts` and `join.ts` all start with `isAllowedRequestOrigin`. The create route doesn't, and with `replaceSessionId` it now closes a session too. The risk is low (Supabase cookies are `SameSite=Lax`, and the attacker needs the session UUID), but the route breaks the project's own pattern for mutating endpoints.
- **Fix**: Add the same `isAllowedRequestOrigin` check at the top of `POST`, returning 403 like `close.ts`.
- **Decision**: FIXED

### F5 — `close_session_as_replaced` accepts a closed or older session as the replacement

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261011133000_session_close_replaced_by.sql:43-50
- **Detail**: The function only checks that the replacement exists and belongs to the same GM. Through `POST /api/sessions/{id}/close`, a GM can point a session at a closed one, or create a cycle (A replaced by B, then B replaced by A). Auto-rejoin can't loop, because join requires an active session, but players get sent to dead codes and the GM board link becomes misleading.
- **Fix**: Add a new migration that redefines the function (`create or replace`) to also require `status = 'active'` on the replacement. Add a matching domain error, or reuse `REPLACEMENT_NOT_FOUND`. Don't edit the migration that's already applied.
- **Decision**: FIXED differently: edited the unpushed migration in place (replacement must be `active`, otherwise `replacement_not_found`). Local Supabase must re-apply the migration.

### F6 — Board kitchen sink shows a GM successor panel that production doesn't render

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/pages/sessions/board/kitchen-sink.astro:452-457 vs src/pages/sessions/[id].astro
- **Detail**: The "closed + successor" kitchen-sink section shows "Sesja zamknięta — następczy kod graczy: …" inline. The real `[id].astro` loads `replaced_by_session_id` but never renders it; a GM on a replaced session only sees the "Zamknięta" badge. The visual gate shows more than production does.
- **Fix A ⭐ Recommended**: Move the panel into production as a small shared component used by both `[id].astro` and the kitchen sink, linking to `/sessions/{replaced_by_session_id}`.
  - Strength: The data is already loaded. A GM who opens an old board (e.g. from the dashboard with "Pokaż zamknięte") gets a one-click way to the current table.
  - Tradeoff: Adds a small UI feature the plan didn't explicitly spell out.
  - Confidence: MED — the plan says the kitchen sink "covers closed (no CTA)" but doesn't specify successor messaging for GMs.
  - Blind spot: Needs the successor's code (another lookup), or must link by id only.
- **Fix B**: Delete the extra paragraph from the kitchen sink so it matches production.
  - Strength: Zero product change; keeps the visual gate honest.
  - Tradeoff: GMs on old boards still have no way to the successor.
  - Confidence: HIGH — a pure deletion.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A (new `GmSuccessorNotice.astro` shared by `[id].astro` and the kitchen sink; production gets the code through `getSessionCodeForGm`, and a failed lookup is reported without breaking the page)

### F7 — Integration and E2E criteria not re-verified after the final commits

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 2.1, 3.1, 4.1, 4.2
- **Detail**: Progress marks the integration and Playwright items done, but `master` is 7 commits ahead of `origin/master`, so CI hasn't run the `smoke` job (integration + e2e) on this work. This review didn't re-run them either, since they need a local Supabase and a preview. The last commit after the e2e work, `68b74d9`, changed the regenerate CTA markup.
- **Fix**: Run `npm run test:integration` and `npm run test:e2e` against a local preview, or push and let the CI `smoke` job confirm.
- **Decision**: ACCEPTED: user will verify (push to CI, or run the suites themselves) after the triage fixes

### F8 — No integration test locks "join on a closed code is rejected"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/integration/play-closed-board-rejoin.test.ts
- **Detail**: The plan's contract says joining a closed code stays rejected. `join.ts:67` enforces it, but the test only checks claim-blocked and join-successor. A regression in join (e.g. accepting `status in (active, closed)`) would go unnoticed.
- **Fix**: Add a case that POSTs `/api/play/join` (JSON mode) with the old code and expects a not-found/rejected response.
- **Decision**: FIXED

### F9 — Dashboard ships the entire session history and filters on the client

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/sessions.service.ts:146-155; src/components/dashboard/DashboardSessionList.tsx:45
- **Detail**: `listSessionsForGm` is `select("*")` with no limit, and the toggle filters closed rows in the browser. Every regenerate adds a closed row, so the page payload grows without bound for active GMs. Fine at MVP scale.
- **Fix**: Leave as is for now. If it grows, filter on the server (`?closed=1`) or cap closed rows (e.g. the latest 20) with a "load more".
  - Strength: Avoids early complexity; the toggle UX stays the same if moved to the server later.
  - Tradeoff: Unbounded HTML growth per GM until addressed.
  - Confidence: MED — real usage volume unknown.
  - Blind spot: No data on how often GMs regenerate.
- **Decision**: ACCEPTED: fine at MVP scale; revisit if dashboards grow

### F10 — Minor hygiene items

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/hooks/useCreateSession.ts:22-25; src/components/play/PlayerBoard.tsx:139; supabase/migrations/20261011133000_session_close_replaced_by.sql:5
- **Detail**: (a) `useCreateSession` discards the specific `closeError` text, so the banner always shows generic copy. (b) The `"N3WCD2"` demo fallback lives in the production `PlayerBoard` (it only applies when `previewClosedChrome` is set). (c) The `replaced_by_session_id` foreign key has no `on delete set null`, which will matter once single-session delete ships (shape seed "usuwanie sesji przez MG"). (d) The `lastNick` fallback can auto-join a visitor who never played the old code. That's per the plan, but it's broader than "players at the table".
- **Fix**: Pass `closeError` through to the banner, move the demo code into kitchen-sink props, and record the foreign-key `on delete` decision for the future delete change.
- **Decision**: FIXED (a, b, c): (a) API returns `closeErrorReason`, the hook passes it as `?closeFailed=<reason>`, and `[id].astro` maps it through `CLOSE_ERROR_MESSAGES` (new `src/lib/close-error-messages.ts`) into the banner's `initialError`, with `SESSION_NOT_ACTIVE` hiding the retry button. (b) The `"N3WCD2"` fallback was removed (the kitchen sink already passes the code). (c) `ON DELETE SET NULL` was added in the unpushed migration. (d) stays per the plan.
