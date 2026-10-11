# GM Regenerate Board — Plan Brief

> Full plan: `context/changes/gm-regenerate-board/plan.md`

## What & Why

MG needs a new board mid-evening (FR-007 / S-05) without juggling two live codes. Close the old session, mint a new one with a new code, and move players to it automatically via the existing poll.

## Starting Point

Create-session + undo + active-only player board are live. `sessions.status` exists (`active`|`closed`) but nothing sets `closed`; sessions RLS has no UPDATE/DELETE. Custom phrases and reward counts are not stored on the session row.

## Desired End State

MG confirms on the board → create form prefills size and reward counts (phrases empty) → new session + code. Old board is closed and read-only. Players with a cookie nick auto-rejoin the successor within ~10s. Dashboard defaults to active sessions with a “Pokaż zamknięte” toggle.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Old session fate | Close (`status → closed`) + `replaced_by_session_id` | Evicts players from the live path while enabling successor handoff |
| Config UX | Re-enter create form | Reuses proven create path; MG can tweak before draw |
| Prefill | Size + reward counts only; phrases empty | Avoids dumping 25 mixed catalog/custom lines |
| Confirm | Board-level confirm before form | Stops accidental mid-game regenerate |
| Close failure | Keep new session; warn + retry close | Never lose the new board on a split write |
| Player closed code | Read-only closed board (not 404) | Explicit product override of S-02 unknown≡closed |
| Player handoff | Poll auto-rejoin with cookie nick (no old claimToken) | Least friction at the table without websockets |
| Closed w/o successor | Same read-only UI, no redirect | One closed UX for future close/delete |
| Dashboard | Active default + “Pokaż zamknięte” | Current table first; history opt-in |
| Verification | Integration + Playwright e2e | Locks HTTP contracts and browser handoff |

## Scope

**In scope:** Close+successor schema/RPC; create with `replaceSessionId`; GM confirm + form prefill; player closed snapshot + auto-rejoin; dashboard toggle; kitchen-sinks; integration + Playwright.

**Out of scope:** Hard DELETE of sessions; same-code multi-board; websockets; atomic create+close RPC; persisting custom phrases / guaranteed flags; team rewards; admin catalog work.

## Architecture / Approach

Create-then-close: `POST /api/sessions` (optional `replaceSessionId`) inserts the new board, then RPC-closes the source with `replaced_by_session_id`. Player board API returns active or closed snapshots (`status`, `successorCode`). `PlayerBoard` poll/load auto-joins the successor when a nick is available. Unknown codes stay 404.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Close + successor model | Migration, RPC, close/retry API | RLS/RPC invariants wrong |
| 2. MG regenerate path | Confirm, prefill, create-then-close UX | Close failure dual-active window |
| 3. Player closed + auto-rejoin | Closed read-only + poll handoff | Claim/join still allowed on closed |
| 4. Dashboard + verification | Toggle + integration + Playwright | E2E flakiness on poll timing |

**Prerequisites:** S-02, S-03, S-04 done; local Supabase for migrations/tests.
**Estimated effort:** ~2–4 sessions across 4 phases.

## Open Risks & Assumptions

- Auto-rejoin assigns a **new** player row/color on the successor session (old claimToken is not reused).
- Closed codes become distinguishable from unknown codes (intentional).
- Session hard-delete remains a separate shape (“usuwanie sesji przez MG”).

## Success Criteria (Summary)

- MG can regenerate from an active board and land on a new code with the old session closed and linked.
- Players on the old code see a read-only closed board and auto-move to the new code when a nick is available.
- Integration + Playwright cover create/close/closed-board and the regenerate → player handoff.
