---
date: 2026-10-07T11:38:31+02:00
researcher: Marcin
git_commit: 21a765889bde6a06c876e58e79a769091b41c64f
branch: master
repository: rpg-bingo
topic: "Play-path claim & undo — where failures live and how Phase 2 should test Risks #3/#4/#5/#7"
tags: [research, codebase, claim, undo, play-path, integration-tests]
status: complete
last_updated: 2026-10-07
last_updated_by: Marcin
last_updated_note: Initial Phase 2 research for test-plan risks #3 #4 #5 #7
---

# Research: Play-path claim & undo test coverage

**Date**: 2026-10-07T11:38:31+02:00  
**Researcher**: Marcin  
**Git Commit**: `21a765889bde6a06c876e58e79a769091b41c64f`  
**Branch**: master  
**Repository**: rpg-bingo

## Research Question

For change `testing-play-path-claim-undo` (test-plan §3 Phase 2): where do Risks #3, #4, #5, and #7 live in the current codebase, and what is the cheapest integration-first way to prove protection — including whether thin e2e is required?

## Summary

On the inspected play path, claim uniqueness is enforced in Postgres by a conditional `UPDATE … WHERE claimed_by_player_id IS NULL` inside SECURITY DEFINER RPC `claim_board_cell` ([supabase/migrations/20261003190000_player_claim_token.sql:168-174](supabase/migrations/20261003190000_player_claim_token.sql)), not by a partial unique index on occupancy. Winner HTTP is **200** `{ cell }`; loser is **409** `{ error: "conflict", occupant, cell }` ([src/pages/api/play/claim.ts:55-65](src/pages/api/play/claim.ts)). Risk #3 needs **parallel** claims from two cookie jars; sequential 200-then-409 (already in smoke) does not exercise the race.

Reward reveal and board recovery are API/SSR contracts: mystery-until-claim in `get_active_board_by_code` ([supabase/migrations/20261003160000_claim_and_board_snapshot.sql:28-35](supabase/migrations/20261003160000_claim_and_board_snapshot.sql)); claim success returns reward slug/label when `reward_id` is set ([20261003190000_player_claim_token.sql:177-192](supabase/migrations/20261003190000_player_claim_token.sql)). Player identity is the httpOnly `rpg_player` cookie only — a repo grep of `src/` found **no** `localStorage`/`sessionStorage` usage. For Risks #4 and #5 on this inspected path, Vitest HTTP integration (join → claim → board GET / page GET with cookie jar) is sufficient; thin e2e is not required unless the product goal is presentation-only (CSS/hydration) bugs.

GM undo clears occupancy columns only and keeps `reward_id` ([supabase/migrations/20261003200000_undo_board_cell.sql:39-45](supabase/migrations/20261003200000_undo_board_cell.sql)). “Invalidate reward” for Risk #7 / FR-012 is observable as player snapshot restoring mystery (`hasReward` true, `reward` null) plus null `claimedByColor` — not as deleting the cell’s reward slot. No happy-path claim/undo/rejoin Vitest exists yet; smoke covers sequential claim + 409; helpers need a form-join + dual-client pattern.

## Detailed Findings

### Risk #3 — Concurrent claim race

- **Path**: `POST /api/play/claim` → cookie `claimToken` → `claimBoardCell` → RPC `claim_board_cell` ([src/pages/api/play/claim.ts:18-65](src/pages/api/play/claim.ts), [src/lib/services/sessions.service.ts:300-339](src/lib/services/sessions.service.ts)).
- **Concurrency mechanism (this RPC)**: first updater matching `claimed_by_player_id IS NULL` wins; concurrent updates serialize on the `board_cells` row; loser takes the conflict branch ([20261003190000_player_claim_token.sql:168-220](supabase/migrations/20261003190000_player_claim_token.sql)). Supporting constraints on the inspected migrations: `UNIQUE (session_id, position)` on cells; `board_cells_claim_pair_chk` for claim pair nullness ([20261003140000_session_players_and_claims.sql:35-40](supabase/migrations/20261003140000_session_players_and_claims.sql)). There is no named “one owner per free cell” unique index beyond the conditional UPDATE.
- **Assert**: among two parallel POSTs (two `createHttpClient()` jars, two joins), exactly one **200** and one **409** with `error: "conflict"` and occupant nick/color; follow-up `GET /api/play/board?code=` shows a single `claimedByColor` on that position.
- **Anti-pattern**: sequential double-POST only (smoke already does this at [scripts/smoke.mjs:237-277](scripts/smoke.mjs)); UI `claimingPosition` serializes one in-flight claim per board ([src/components/play/PlayerBoard.tsx:171](src/components/play/PlayerBoard.tsx)).

### Risk #4 — Claim + reward reveal

- **Join**: form `POST /api/play/join` → 302 + `Set-Cookie` `rpg_player` ([src/pages/api/play/join.ts](src/pages/api/play/join.ts); smoke [scripts/smoke.mjs:221-227](scripts/smoke.mjs)).
- **Claim success body**: `PlayerBoardCell` with `hasReward`, `reward` (`{ slug, label } | null`), `claimedByColor` ([src/types.ts:65-87](src/types.ts)).
- **Mystery rule**: unclaimed cells expose presence via `hasReward`; slug/label null until claimed ([20261003160000_claim_and_board_snapshot.sql:28-35](supabase/migrations/20261003160000_claim_and_board_snapshot.sql); [src/types.ts:61-70](src/types.ts)).
- **UI**: `PlayerBoard` merges claim/poll JSON into state; flip animation is cosmetic ([src/components/play/PlayerBoard.tsx:170-196,257-258](src/components/play/PlayerBoard.tsx)). No separate reveal endpoint on the inspected path.
- **Assert (HTTP)**: create session with ≥1 catalog reward → player board GET shows mystery on that cell → claim → 200 with non-null `reward.label` → refresh via `GET /api/play/board` (and optionally `GET /play/{code}` with same jar) still shows claim + reward.
- **Gap for fixtures**: Phase 1 create tests use `rewards: []` ([tests/integration/create-session-board.test.ts](tests/integration/create-session-board.test.ts)); seed rewards have slugs but generated UUIDs ([supabase/seed.sql:39-72](supabase/seed.sql)); catalog is loaded only in SSR `/sessions/new` ([src/pages/sessions/new/index.astro:11-14](src/pages/sessions/new/index.astro)) — no public rewards HTTP API in `src/pages/api`. Plan must pick how to obtain a real `rewardId` under preview-HTTP-only rules.

### Risk #5 — Stale client / rejoin without cache clear

- **Persistence**: `PLAYER_COOKIE_NAME` = `rpg_player`; httpOnly, path `/`, ~400-day max-age; identity keyed by session code with required `claimToken` ([src/lib/player-cookie.ts:3-4,88-96,130-132,176-183](src/lib/player-cookie.ts)).
- **Refresh**: SSR `[code].astro` reloads via `getActiveBoardByCode` + cookie; no client board store ([src/pages/play/[code].astro:43-70](src/pages/play/[code].astro)).
- **Rebind**: join RPC accepts prior `p_claim_token` and returns the same seat ([20261003190000_player_claim_token.sql:76-91](supabase/migrations/20261003190000_player_claim_token.sql)).
- **Verdict for this codebase**: Risk #5’s “clear storage/cache” wording does not match an app-level `localStorage` board cache (none under `src/`). Cheapest proof is cookie jar retained across `GET /play/{code}` and `GET /api/play/board` after claim, plus optional rejoin POST with same jar still claiming as the same seat. Thin e2e not required for the recovery contract on this inspected path.

### Risk #7 — GM undo frees cell but leaves grant intact

- **Path**: authenticated GM `POST /api/sessions/{id}/undo-claim` `{ position }` → `undo_board_cell` ([src/pages/api/sessions/[id]/undo-claim.ts:19-58](src/pages/api/sessions/[id]/undo-claim.ts); [20261003200000_undo_board_cell.sql:4-58](supabase/migrations/20261003200000_undo_board_cell.sql)).
- **Side effects (inspected RPC)**: sets `claimed_by_player_id` / `claimed_at` to NULL; does **not** clear `reward_id`; requires `gm_id = auth.uid()` and `status = 'active'`.
- **FR-012 mapping**: PRD says undo voids the associated reward ([context/foundation/prd.md](context/foundation/prd.md) FR-012). Implemented meaning on the player path: occupancy free + mystery restored (`reward` null while `hasReward` may stay true). Physical reward slot remains for reclaim (archive undo plan; migration comment line 1).
- **Assert**: after claim → undo → GM `GET …/board` null occupancy + same `reward_id`; player `GET /api/play/board` null `claimedByColor` and mystery reward fields; optional reclaim → 200 again.
- **Kitchen-sink**: `freeCellLocally` only nulls UI color — not the production path ([src/components/sessions/GmBoard.tsx](src/components/sessions/GmBoard.tsx) preview mode). Do not test via kitchen-sink.

### Existing harness (reuse)

| Asset | Role for Phase 2 |
|-------|------------------|
| `tests/helpers/http.ts` | Cookie jar, default `Origin`, `signIn`, `skipIf(!hasBaseUrl())` |
| `scripts/smoke.mjs:221-304` | Cookbook for form join, claim 200, second player, sequential 409, board poll shape |
| `tests/integration/http-contract-matrix.test.ts` | Claim/undo **failure** statuses only; forged cookie for negatives |
| `tests/integration/create-session-board.test.ts` | GM create + board GET side-effect pattern |
| Cookbook §6.5 claim/undo | Still TBD in [context/foundation/test-plan.md](context/foundation/test-plan.md) |

**Missing helpers (not in `http.ts` today):** `joinPlayer` (form POST + 302), dual-client factory guidance, session bootstrap returning `{ id, code }`, shared claim/conflict/board cell asserts, catalog `rewardId` acquisition.

**Parallelism:** `Promise.all` of two clients’ claim requests is feasible in one `it`. Vitest integration files can run in parallel against one preview — each file/case should create its own session to avoid cross-talk.

## Code References

- `src/pages/api/play/claim.ts:55-65` — 409 conflict vs 200 success
- `src/pages/api/play/join.ts` — form join + cookie write + claimToken rebind
- `src/pages/api/play/board.ts` — public player board snapshot
- `src/pages/api/sessions/[id]/undo-claim.ts:19-58` — GM undo
- `src/lib/player-cookie.ts` — `rpg_player` contract
- `src/lib/services/sessions.service.ts:51-67,203-228,300-339,365-416` — map cell, board, claim, undo
- `supabase/migrations/20261003190000_player_claim_token.sql:168-220` — first-wins claim RPC
- `supabase/migrations/20261003160000_claim_and_board_snapshot.sql:28-35` — mystery-until-claim
- `supabase/migrations/20261003200000_undo_board_cell.sql:39-45` — undo clears occupancy only
- `scripts/smoke.mjs:221-304` — existing sequential claim/conflict smoke
- `tests/helpers/http.ts:109-189` — integration HTTP client

## Architecture Insights

- Claims and undo are **RPC-authoritative**; players have no direct `UPDATE` on `board_cells` via RLS — tests should assert HTTP + follow-up GET, not mirror app-level “check then update” logic.
- Player mutating POSTs need matching `Origin` ([src/lib/request-origin.ts](src/lib/request-origin.ts)); helpers already set it.
- Auth split: claim = player cookie + code; undo = GM Supabase session; abuse of forged identity is Phase 3 (Risks #6/#8).
- Smoke uses `rewards: []`, so it does **not** prove FR-010/011 reward label reveal.

## Historical Context (from prior changes)

| Claim | Verdict | Notes |
|-------|---------|-------|
| First-wins via conditional UPDATE | **Supported** | Archive player-claim plan; live RPC `20261003190000` |
| Mystery until claim; reveal on claim success | **Supported** | Snapshot CASE + claim RETURNING join |
| Auth via `claim_token`, no public player ids on roster | **Supported** | impl-review Fix A; smoke asserts no `id`/`claimToken` on players |
| Undo clears occupancy, keeps `reward_id` | **Supported** | Archive gm-undo plan + `20261003200000` |
| FR-012 “unieważnia nagrodę” = delete reward_id | **Contradicted** by implementation | Treat as player-visible de-reveal + free cell |
| Phase 1 deferred claim race / undo / rejoin Vitest | **Supported** | `testing-runner-bootstrap-board-integrity` plan exclusions; cookbook §6.5 TBD |

Related archives: `context/archive/2026-10-03-player-claim-field-reward/`, `context/archive/2026-10-03-gm-undo-field-claim/`.

## Related Research

- Phase 1 change folder `context/changes/testing-runner-bootstrap-board-integrity/` (or its archive, if moved) — preview-HTTP-only runner and create-board cookbook.
- No prior `research.md` in this change folder before this document.

## Open Questions

1. **Catalog `rewardId` in integration tests** — how to obtain a seeded reward UUID without a rewards API (SSR scrape of `/sessions/new`, fixed seed UUIDs, or another approved fixture). Blocks full Risk #4 reward-label assertions; ownership-only claim tests can proceed without it.
2. **Whether to extend `tests/helpers/http.ts`** with `joinPlayer` / session bootstrap vs keeping helpers local to the new Phase 2 test file — product/process choice for `/10x-plan`.
3. **How aggressive the parallel race test should be** (single `Promise.all` pair vs N retries) — one parallel pair matches the risk; flakiness under load is unknown (concurrency not measured in this research).

## Planning handoff

**Settled for `/10x-plan`:**

- Layer: Vitest integration against preview (+ local Supabase), same as Phase 1; thin e2e **not** required for #4/#5 on current architecture.
- Must cover: parallel dual-client claim race (#3); claim + reward reveal + board GET persistence (#4, needs reward fixture); cookie-jar refresh/rejoin (#5); claim → undo → GM + player board consistency + optional reclaim (#7).
- Reuse smoke join/claim shapes; prefer two `createHttpClient()` instances over `jar.delete("rpg_player")` on one client for multi-player cases.
- Fill cookbook §6.5 claim/undo/rejoin when the phase ships.

**Do not** treat kitchen-sink, pixel snapshots, or sequential-only double-claim as Phase 2 proof for #3.
