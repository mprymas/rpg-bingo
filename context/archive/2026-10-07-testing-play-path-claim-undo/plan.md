# Play-path claim & undo test coverage Implementation Plan

## Overview

Add Vitest preview-HTTP integration coverage for test-plan Phase 2 Risks #3 (parallel claim race), #4 (claim + reward reveal), #5 (cookie rejoin without cache clear), and #7 (GM undo frees cell + reclaim). Prove protection at the HTTP + follow-up board snapshot layer — no thin e2e.

## Current State Analysis

Claim uniqueness is enforced in Postgres by a conditional `UPDATE … WHERE claimed_by_player_id IS NULL` inside SECURITY DEFINER RPC `claim_board_cell`. Winner HTTP is 200 `{ cell }`; loser is 409 `{ error: "conflict", occupant, cell }`. Smoke covers sequential 200-then-409 only — not the race.

Player board snapshots mystery-until-claim (`hasReward` true, `reward` null until claimed). Identity is the httpOnly `rpg_player` cookie; there is no app-level `localStorage` board cache under `src/`.

GM undo clears occupancy columns and keeps `reward_id`. FR-012 “invalidate reward” on the player path means free cell + mystery restored, not deleting the reward slot.

Existing harness: `tests/helpers/http.ts` (cookie jar, Origin, `signIn`), `tests/integration/create-session-board.test.ts` (GM create + board GET), `tests/integration/http-contract-matrix.test.ts` (claim/undo failure statuses only), `scripts/smoke.mjs` join/claim cookbook. Missing: `joinPlayer`, dual-client race Vitest, happy-path undo/rejoin, catalog `rewardId` for create-with-rewards. Seed rewards today omit explicit `id` (`gen_random_uuid()`); CI smoke runs `supabase start` without an explicit seed step. Cookbook §6.5 claim/undo remains TBD.

### Key Discoveries:

- Concurrent claim path: `src/pages/api/play/claim.ts:55-65` + RPC in `supabase/migrations/20261003190000_player_claim_token.sql:168-220`
- Mystery-until-claim: `supabase/migrations/20261003160000_claim_and_board_snapshot.sql:28-35`; player DTO `src/types.ts:65-71`
- Undo clears occupancy only: `supabase/migrations/20261003200000_undo_board_cell.sql:39-45`
- Smoke sequential claim/conflict: `scripts/smoke.mjs:221-304`
- Integration HTTP client: `tests/helpers/http.ts:109-189`
- Seed reward slugs without fixed ids: `supabase/seed.sql:39-72`
- CI smoke starts Supabase then preview/integration: `.github/workflows/ci.yml` Start local Supabase step — no `supabase seed` yet
- Phase 1 deferred claim race / undo / rejoin: `context/changes/testing-runner-bootstrap-board-integrity/plan.md` exclusions

## Desired End State

A Vitest integration file exercises dual-client parallel claim, reward reveal via slug-resolved catalog fixture, cookie-jar refresh/rejoin, and claim→undo→reclaim with GM + player board side-effect asserts. Shared `joinPlayer` / `createActiveSession` live in `tests/helpers/http.ts`. Seed ships fixed reward UUIDs; tests address rewards by slug. CI applies seed after local Supabase start. Cookbook §6.5 documents the pattern; test-plan Phase 2 is marked done.

Verification: `PREVIEW_BASE_URL=… npm run test:integration` greens the new cases against a seeded local Supabase + preview; CI smoke job applies seed and runs the same suite.

## What We're NOT Doing

- Thin Playwright e2e, kitchen-sink routes, or pixel/snapshot UI for #4/#5
- Treating sequential double-claim (smoke) as Risk #3 race proof
- Phase 3 abuse / forged-identity / unauthenticated MG route breadth
- Deleting `reward_id` on undo (contradicted by implementation; assert mystery + free occupancy)
- Public rewards REST API or Supabase client/SQL inside integration tests
- Expanding `http-contract-matrix` into happy-path claim/undo (new dedicated file)
- Hosted `supabase db reset` / seed against linked production (lessons.md)

## Implementation Approach

Fixture-first: make catalog IDs deterministic and available in CI, then thin shared join/session helpers, then one integration suite covering the four risks with status + follow-up GET asserts (smoke shapes, dual `createHttpClient` for multi-player). Close with cookbook + Phase 2 status.

## Phase 1: Catalog fixture + CI seed

### Overview

Give create-with-rewards a stable, slug-keyed catalog fixture and ensure CI’s ephemeral Supabase loads seed so Risk #4 does not skip or fail on empty rewards.

### Changes Required:

#### 1. Deterministic seed reward ids

**File**: `supabase/seed.sql`

**Intent**: Insert catalog rewards with explicit UUIDs so local/CI databases share the same id-per-slug mapping after seed; keep upsert-by-slug for label/description.

**Contract**: `INSERT INTO public.rewards (id, slug, label, description)` for slugs `inspiration`, `item`, `side-quest`, `clue`, `npc-help`, `experience` with fixed UUIDs; retain `ON CONFLICT (slug) DO UPDATE` of label/description (not a hosted wipe). Existing local DBs with random ids need one local `supabase db reset` (or equivalent) so map and DB agree — never against hosted.

#### 2. Slug → id test map

**File**: `tests/helpers/seed-rewards.ts` (or equivalent under `tests/helpers/`)

**Intent**: Let tests/create bodies address rewards by slug, not raw UUID literals as the primary handle.

**Contract**: Export something like `rewardIdForSlug(slug: string): string` backed by a map whose values match the fixed seed UUIDs (at least `inspiration` used by #4). Call sites use `rewardIdForSlug('inspiration')` in `rewards: [{ rewardId, count }]`.

#### 3. CI applies seed after start

**File**: `.github/workflows/ci.yml`

**Intent**: Guarantee catalog rows exist before preview smoke + `test:integration` on the smoke job.

**Contract**: After `npx supabase start …` (local only), run `npx supabase seed` (or documented local-only equivalent). Do not use `db reset --linked` or any hosted target. Keep smoke user creation and preview steps after seed.

### Success Criteria:

#### Automated Verification:

- Seed SQL is valid SQL with six explicit reward ids matching the slug map keys
- `rewardIdForSlug('inspiration')` returns the seed UUID for `inspiration`
- CI workflow YAML includes a local seed step after `supabase start`

#### Manual Verification:

- On a fresh local Supabase, after seed, creating a session with `rewardIdForSlug('inspiration')` succeeds (not UNKNOWN_REWARD)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Play-path helpers

### Overview

Centralize form-join and GM session bootstrap so Phase 3 cases do not copy smoke wiring.

### Changes Required:

#### 1. Shared HTTP helpers

**File**: `tests/helpers/http.ts`

**Intent**: Add thin helpers for player join and authenticated session create reused across Phase 3 cases.

**Contract**:

- `joinPlayer(client, { code, nick })` — form `POST /api/play/join`, expect 302, rely on existing jar/`Origin` behavior to store `rpg_player`
- `createActiveSession(gmClient, body)` — JSON `POST /api/sessions`, expect success create status, return `{ id, code }`
- Dual-player/race guidance: prefer two `createHttpClient()` instances over `jar.delete("rpg_player")` on one client
- Keep claim/undo/board assertion oracles out of this file (Phase 3 local)

### Success Criteria:

#### Automated Verification:

- Helpers export and typecheck with existing `HttpClient` patterns
- Unit-free: no new product runtime code required; `npm run lint` / project typecheck paths that include `tests/helpers` stay clean if already gated

#### Manual Verification:

- None beyond Phase 3 consumption (helpers are proven by integration cases)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Play-path integration suite

### Overview

One Vitest integration file proves Risks #3, #4, #5, and #7 with HTTP status + side-effect GETs against preview.

### Changes Required:

#### 1. New integration file

**File**: `tests/integration/play-path-claim-undo.test.ts`

**Intent**: Cover parallel claim race, reward reveal, cookie rejoin, and undo+reclaim without kitchen-sink or sequential-only race proof.

**Contract**:

- Gate with `describe.skipIf(!hasBaseUrl())` and credentials when GM auth required (same pattern as `create-session-board.test.ts`)
- Each case creates its own session (avoid cross-talk under parallel Vitest)
- **#3**: two clients join → one `Promise.all` pair of `POST /api/play/claim` on the same position → exactly one 200 and one 409 with `error: "conflict"` and occupant nick/color; follow-up `GET /api/play/board?code=` shows a single `claimedByColor` on that position
- **#4**: create with `rewards: [{ rewardId: rewardIdForSlug('inspiration'), count: ≥1 }]` → player board shows mystery on a rewarded free cell → claim 200 with non-null `reward.label` → `GET /api/play/board` (and optionally `GET /play/{code}` same jar) still shows claim + revealed reward
- **#5**: after claim, same cookie jar recovers board via `GET /api/play/board` and/or `GET /play/{code}`; form rejoin with same jar keeps the seat (still authorized); no manual cache clear
- **#7**: claim → GM `POST /api/sessions/{id}/undo-claim` `{ position }` → 200 with occupancy null and `reward_id` preserved on GM cell → player board `claimedByColor` null + mystery (`reward` null, `hasReward` may stay true) → reclaim 200 on that position
- Assert status + observable fields; do not snapshot full bodies; do not use kitchen-sink
- Local oracles for claim conflict / mystery / undo may live in this file

### Success Criteria:

#### Automated Verification:

- `PREVIEW_BASE_URL=<preview> npm run test:integration` includes and passes the new play-path cases against seeded local Supabase
- Race case uses parallel dual-client claims (not sequential-only)
- #4 case fails if catalog missing / wrong slug map (no silent skip of reward reveal)

#### Manual Verification:

- Spot-check one parallel claim and one undo+reclaim against local preview if CI is unavailable

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Cookbook + Phase 2 status

### Overview

Document the play-path pattern for future contributors and close the rollout row.

### Changes Required:

#### 1. Test-plan cookbook and phase status

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.5 claim/undo TBD with the Phase 2 pattern; record that thin e2e is not required for #4/#5 on current architecture; mark Phase 2 done.

**Contract**:

- §6.5: join via `joinPlayer`, dual clients for race, slug→id for rewards, claim/undo/rejoin assert shapes, reference the new integration file
- §6.3: note research verdict — no e2e required for #4/#5 given cookie/SSR recovery (or leave TBD only if still “optional and unused”)
- §3 table: Phase 2 Status → `done`; Change folder remains `testing-play-path-claim-undo`
- §8 freshness ledger: bump last-updated / relevant lines for Phase 2 cookbook fill

### Success Criteria:

#### Automated Verification:

- Markdown sections exist: §6.5 describes claim/undo/rejoin steps; Phase 2 row status is `done`

#### Manual Verification:

- A new contributor can follow §6.5 without reading the planning chat

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human.

---

## Testing Strategy

### Unit Tests:

- None required for seed SQL / YAML. Optional tiny pure test for `rewardIdForSlug` unknown-slug throw only if the helper is non-trivial.

### Integration Tests:

- Parallel dual-client claim race (#3)
- Mystery → claim reveal → board persistence (#4)
- Cookie jar refresh + rejoin (#5)
- Claim → undo → player mystery → reclaim (#7)

### Manual Testing Steps:

1. Local: `supabase start` + seed, preview, run `test:integration` for the new file
2. Confirm CI smoke job logs show seed applied before integration
3. Optional: two browsers / two clients claiming one cell; GM undo then reclaim

## Migration Notes

- Changing seed to fixed ids does not rewrite existing local rows’ primary keys on `ON CONFLICT (slug)` label-only updates. After pulling this change, run a **local-only** `supabase db reset` (or recreate the local DB) so ids match `rewardIdForSlug`. Never reset hosted Supabase.
- CI ephemeral DB: start + seed is sufficient.

## References

- Related research: `context/changes/testing-play-path-claim-undo/research.md`
- Test plan Phase 2: `context/foundation/test-plan.md` §3 Phase 2, §6.5
- Smoke claim/conflict: `scripts/smoke.mjs:221-304`
- Phase 1 exclusions: `context/changes/testing-runner-bootstrap-board-integrity/plan.md`
- Lessons: never hosted `db reset` — `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Catalog fixture + CI seed

#### Automated

- [x] 1.1 Seed SQL is valid SQL with six explicit reward ids matching the slug map keys — f326073
- [x] 1.2 `rewardIdForSlug('inspiration')` returns the seed UUID for `inspiration` — f326073
- [x] 1.3 CI workflow YAML includes a local seed step after `supabase start` — f326073

#### Manual

- [x] 1.4 On a fresh local Supabase, after seed, creating a session with `rewardIdForSlug('inspiration')` succeeds (not UNKNOWN_REWARD)

### Phase 2: Play-path helpers

#### Automated

- [x] 2.1 Helpers export and typecheck with existing `HttpClient` patterns — 27804f7
- [x] 2.2 Unit-free: no new product runtime code required; `npm run lint` / project typecheck paths that include `tests/helpers` stay clean if already gated — 27804f7

### Phase 3: Play-path integration suite

#### Automated

- [x] 3.1 `PREVIEW_BASE_URL=<preview> npm run test:integration` includes and passes the new play-path cases against seeded local Supabase — b4b0e19
- [x] 3.2 Race case uses parallel dual-client claims (not sequential-only) — b4b0e19
- [x] 3.3 #4 case fails if catalog missing / wrong slug map (no silent skip of reward reveal) — b4b0e19

#### Manual

- [x] 3.4 Spot-check one parallel claim and one undo+reclaim against local preview if CI is unavailable

### Phase 4: Cookbook + Phase 2 status

#### Automated

- [x] 4.1 Markdown sections exist: §6.5 describes claim/undo/rejoin steps; Phase 2 row status is `done` — dace347

#### Manual

- [x] 4.2 A new contributor can follow §6.5 without reading the planning chat
