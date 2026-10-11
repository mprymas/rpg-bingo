# Threshold & Row/Column Rewards — Plan Brief

> Full plan: `context/changes/threshold-pattern-rewards/plan.md`

## What & Why

Fields without a per-field reward give players no goal (found at a real table session). We add two optional reward rules next to per-field rewards: a reward for holding N claimed fields and a reward for each completed row/column. Satisfaction comes from visible progress toward these rewards, not from new effects. Roadmap S-02, north star of M-2.

## Starting Point

Rewards exist only per field (`board_cells.reward_id`); a grant is just cell occupancy, and GM undo clears occupancy so the field returns to mystery. Positions are row-major 0…size²−1 (3/4/5). No earned-rewards ledger, no row/column logic, no progress UI.

## Desired End State

The GM ticks catalog rewards for "Nagroda za wiersz/kolumnę" and for "Nagroda za [N] pól" (N defaults to board size); nothing ticked = rule off. Players see "Zdobyte pola: X/N" and "Twoje nagrody" with earned threshold/line rewards right after claiming; the GM roster shows each player's earned rewards. Undo revokes automatically; old sessions behave exactly as today.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Line ownership | Completer wins: whoever claims the last free field of a fully claimed line (latest `claimed_at`) | Lines complete often on a shared board and create "steal the line" moments. |
| Threshold winners | Every player reaching N earns it | A personal goal for each player, derivable from counts. |
| Repeatability | Threshold once per player; each completed line is a separate reward | "One readable threshold" per PRD while lines stay a repeatable goal. |
| Patterns | Rows and columns only | PRD example, smallest scope at `speed`. |
| Configuration | Two catalog multi-selects (none ticked by default) + N input defaulting to board size | Optional by default; GM decides which rewards can drop. |
| Draw timing | Pre-drawn: one reward per row/column at generation, threshold reward per player at join | Stable under undo/reclaim; no grant ledger. |
| Earned state | Derived from current claims by one pure TS function | Undo needs no change; one rule for GM and player. |
| Hidden info | Player RPC reveals a line reward only when the line is full, threshold reward only at ≥ N | Keeps the existing mystery rule. |
| Satisfaction UX | No new animation/banner — progress + earned list only | Approaching a reward is itself the satisfaction. |
| Visibility | Player: own progress + earned list; GM: earned per player in roster | Clear goal for players; no bookkeeping for the GM. |
| Tests | Unit + integration, no e2e | Pure rules are unit-testable; undo integrity is integration (test-plan risk #7). |

## Scope

**In scope:**
- Migration: `sessions.threshold_count`, `session_reward_pool`, `board_lines`, `session_players.threshold_reward_id` (RLS on); join draw; `get_player_reward_inputs` RPC
- `drawLineRewards` + `deriveRewardProgress` with unit tests
- Create-session schema/service/form + regenerate prefill + kitchen sink
- Player board/claim `progress`, GM roster `earned`, kitchen sinks, integration tests

**Out of scope:**
- Diagonals, per-player-owned or team lines, repeated threshold rewards
- Draw-at-earn / grant ledger; new animations, banners, confetti
- Other players' rewards on the player board; line markers on the board
- Forcing rules on old sessions; per-field, undo or join-by-code changes; e2e

## Architecture / Approach

Store rules and pre-drawn rewards; derive earned state. `deriveRewardProgress(size, cells, lines, thresholdCount, thresholdRewardByPlayer)` is fed by the GM snapshot (RLS reads, keyed by player id) and by the player snapshot (SECURITY DEFINER RPC keyed by `claim_token`, mapped to `"me"`/`"other"`). Claim responses and board polls carry `progress`; GM undo triggers an immediate GM refresh.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model & RPCs | Tables, columns, RLS, join draw, player inputs RPC, types | Rewriting `join_session_player` must not change rebind/colour behaviour |
| 2. Pure reward logic | `drawLineRewards`, `deriveRewardProgress` + unit tests | Completer tiebreak / row-major mapping off by one |
| 3. Create & regenerate | Schema, service inserts, form sections, prefill, kitchen sink | Backward compat for bodies without new fields |
| 4. Progress on boards | Player progress + earned list, GM roster, integration tests | Leaking unearned rewards to players |

**Prerequisites:** local Supabase (Docker) for migrations and integration tests; S-01 QR change touches `[id].astro` / board kitchen sink — rebase carefully.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Create is sequential inserts (not one transaction), so a failure after `board_cells` can leave a session without its rules — same risk class as today, accepted.
- Completer rule means undo + reclaim can move a line reward to a different player — intended.
- Rules are fixed at create, so every player joins after them and gets a threshold draw; after regenerate, players rejoin the new session and draw again.

## Success Criteria (Summary)

- At the table, a player completing a row or reaching N sees the reward in "Twoje nagrody" immediately, and the GM sees it in the roster.
- GM undo removes an invalidated line/threshold reward; reclaiming restores it.
- Existing sessions and per-field rewards work exactly as before.
