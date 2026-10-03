# GM Undo Field Claim — Plan Brief

> Full plan: `context/changes/gm-undo-field-claim/plan.md`

## What & Why

MG needs to correct a wrong field mark at the table without ending the session. Undo frees the cell and voids the claimer’s reward grant by clearing occupancy while leaving the cell’s reward slot in place for a future claim (FR-012).

## Starting Point

S-03 shipped first-wins claims, player mystery snapshots, and a read-only GM board with colors + roster + 5s poll. There is no undo RPC, API, or GM click path.

## Desired End State

On an active session board, MG clicks a claimed tile, confirms with on-tile Check (X cancels), waits for the server, and sees the cell free again. Players’ polls restore mystery-until-claim; the same reward can be won again on that cell.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Void reward | Clear claim only; keep `reward_id` | Grant = occupancy; layout rewards stay for reclaim |
| Trigger | Click claimed cell | Grid is the control surface |
| Confirm | On-tile Check (undo) / X (keep) | Mis-tap protection without modal |
| Session gate | `active` only (UI + RPC) | Align with claim/join lifecycle |
| Already free | Idempotent success | Quiet under race/double confirm |
| Client update | Wait for API | Board never shows a false free |
| Verification | Kitchen-sink + smoke + manual path | Matches prior board slices |

## Scope

**In scope:**

- SECURITY DEFINER `undo_board_cell` migration + typegen
- GM `POST /api/sessions/[id]/undo-claim` + service/schema/types
- `success` design token; `GmBoard` on-tile confirm UX (wait-for-API)
- Kitchen-sink fixtures; lint/build/smoke + manual claim→undo→reclaim

**Out of scope:**

- Clearing `reward_id` / permanent reward removal from the cell
- Team-line rewards (FR-014); player-initiated undo; closed-session undo
- Optimistic UI; websockets; regenerate board (S-05)

## Architecture / Approach

SECURITY DEFINER `undo_board_cell` (GM `auth.uid()`, active-only) clears claim columns and returns the free cell. Authenticated `POST /api/sessions/[id]/undo-claim` wraps it. `GmBoard` opens on-tile Check/X on claimed cells, waits for the response, then updates; players learn via existing board polls.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. DB undo RPC | Atomic clear + idempotent return | Wrong auth/status opacity |
| 2. Service + API | GM POST contract | Origin/auth gaps |
| 3. GmBoard UX | On-tile confirm + wait | Poll clobbering confirm state |
| 4. Kitchen-sink + verify | Visual + table path | Hosted migration lag |

**Prerequisites:** S-03 done; local Supabase for migrate + typegen. Hosted `db push` is human-approved later.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Hosted schema must receive the migration before production undo works.
- “Green” Check requires a new `success` token (no palette classes in scoped views).
- Tick means **confirm undo** (not “keep claim”) — label carefully for a11y.

## Success Criteria (Summary)

- MG can undo a claimed cell on an active board with on-tile confirm and see it free after the request completes.
- Players see the cell free (and mystery reward frame if applicable) within ~10s; reclaim can win the same reward.
- Closed sessions cannot undo; already-free undo does not error.
